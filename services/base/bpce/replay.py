"""Session replay transport for the BPCE web front ends (Caisse d'Epargne, Banque Populaire).

The banks have no public API. The data calls need a short-lived Bearer token
that the browser obtains with an OAuth2 PKCE + SAML chain; the SSO cookies
captured at login are enough to replay that chain without a browser. Observed
on the real banks (Caisse d'Epargne 2026-10-06/07, Banque Populaire 2026-11-05):

  1. POST {authorize}?<params>  (fresh PKCE challenge + nonce)
       -> {action, parameters{SAMLRequest}}
  2. POST action  form SAMLRequest  (cookies carry the SSO session)
       -> {response{status: "AUTHENTICATION_SUCCESS", saml2_post{action, samlResponse}}}
  3. POST saml2_post.action  form SAMLResponse
       -> {parameters{code}}
  4. POST {token}  form grant_type/client_id/code/code_verifier/redirect_uri
       -> {access_token, token_type: "Bearer", expires_in ~ 267 s}

The AUTHENTICATION_SUCCESS status of step 2 is the session-validity signal.
`/gsu/sessions/me/status` is not: it answers 202 on live sessions too.

The hosts, and the optional second OAuth apps, come from the `Site` passed at
call time; every URL must pass that site's `is_allowed_url`.

Never logged or returned: cookies, SAML payloads, authorization codes, tokens
and the authorize parameters (they carry a login hint).

Deliberately absent: login initiation, password, virtual keypad, Securpass,
logout and accounts reading.
"""

import asyncio
import base64
import functools
import hashlib
import html.parser
import json
import logging
import re
import secrets
import time
import urllib.parse
import weakref
from dataclasses import dataclass, field
from typing import Any, Callable

import httpx

from .site import ChainProfile, Site

log = logging.getLogger("bpce")
# httpx logs every request URL at INFO and the authorize URL carries the
# authorize parameters (including a login hint) in its query string.
for _noisy in ("httpx", "httpcore"):
    logging.getLogger(_noisy).setLevel(logging.WARNING)

AUTHN_SUCCESS = "AUTHENTICATION_SUCCESS"

REQUEST_TIMEOUT_SECONDS = 25.0
CONNECT_TIMEOUT_SECONDS = 10.0
MAX_RESPONSE_BYTES = 1_048_576
# The token is dropped this long before the bank says it expires.
TOKEN_SAFETY_MARGIN_SECONDS = 30.0
MAX_TOKEN_LIFETIME_SECONDS = 3600.0
SHAPE_MAX_KEYS = 30
# Field names that travel with a secret: kept out of the log even as names.
SENSITIVE_KEYS = frozenset({"SAMLRequest", "SAMLResponse", "login_hint", "code_verifier"})
MAX_CACHED_TOKENS = 64

USER_AGENT = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
)

_LABEL = r"[a-z0-9](?:[a-z0-9-]*[a-z0-9])?"


# --- Typed errors ------------------------------------------------------------


class ReplayError(Exception):
    """Base class. `code` is the stable, caller-facing error code.

    Messages are fixed strings: they never embed upstream or caller data.
    """

    code = "UPSTREAM_ERROR"

    def __init__(self, message: str | None = None):
        super().__init__(message or self.code)


class InvalidSessionState(ReplayError):
    code = "INVALID_SESSION_STATE"


class SessionExpired(ReplayError):
    code = "SESSION_EXPIRED"


class UpstreamError(ReplayError):
    code = "UPSTREAM_ERROR"


class HostNotAllowed(UpstreamError):
    """A URL left the site's https allow-list; nothing was sent."""


# --- SSRF guard --------------------------------------------------------------


@functools.lru_cache(maxsize=8)
def _host_pattern(domain: str) -> re.Pattern[str]:
    return re.compile(rf"^(?:{_LABEL}\.)+{re.escape(domain)}$")


def is_allowed_url(site: Site, url: Any) -> bool:
    """True only for an https URL on a strict `*.<site.domain>` host or one of `site.extra_hosts`."""
    if not isinstance(url, str) or not url or "\\" in url:
        return False
    if any(ord(char) <= 0x20 or ord(char) == 0x7F for char in url):
        return False
    try:
        parsed = urllib.parse.urlsplit(url)
        host = parsed.hostname
        port = parsed.port
    except ValueError:
        return False
    if parsed.scheme != "https" or parsed.username is not None or parsed.password is not None:
        return False
    if port not in (None, 443) or not host:
        return False
    return _host_pattern(site.domain).match(host) is not None or host in site.extra_hosts


def _require_allowed(site: Site, url: Any) -> str:
    if not is_allowed_url(site, url):
        log.warning("Refused a URL on host %s", _host_for_log(url))
        raise HostNotAllowed(f"Refused a URL outside https *.{site.domain}")
    return url


def _host_for_log(url: Any) -> str:
    """The host alone (never a path, a query or credentials), or what kind of value it was."""
    if not isinstance(url, str):
        return type(url).__name__
    try:
        return urllib.parse.urlsplit(url).hostname or "(none)"
    except ValueError:
        return "(unparsable)"


# --- Session state -----------------------------------------------------------


@dataclass(frozen=True)
class SessionState:
    cookies: list[dict[str, str]] = field(repr=False)
    authorize_params: dict[str, str] = field(repr=False)


def parse_session_state(raw: Any) -> SessionState:
    """Validate `{cookies:[{name,value,domain,path}], authorizeParams:{...}}`.

    `authorizeParams` is the authorize query as captured at login; its content
    is opaque apart from the two fields the token request repeats.
    """
    if not isinstance(raw, str):
        raise InvalidSessionState("Session state is not a string")
    try:
        decoded = json.loads(raw)
    except ValueError as exc:
        raise InvalidSessionState("Session state is not JSON") from exc
    if not isinstance(decoded, dict):
        raise InvalidSessionState("Session state is not an object")

    cookies = decoded.get("cookies")
    if not isinstance(cookies, list) or not cookies:
        raise InvalidSessionState("Session state has no cookies")
    clean_cookies: list[dict[str, str]] = []
    for cookie in cookies:
        if (
            not isinstance(cookie, dict)
            or not isinstance(cookie.get("name"), str)
            or not cookie["name"]
            or not isinstance(cookie.get("value"), str)
            or not isinstance(cookie.get("domain"), str)
            or not cookie["domain"]
            or not isinstance(cookie.get("path", "/"), str)
        ):
            raise InvalidSessionState("Session state has a malformed cookie")
        clean_cookies.append(
            {
                "name": cookie["name"],
                "value": cookie["value"],
                "domain": cookie["domain"],
                "path": cookie.get("path") or "/",
            }
        )

    params = decoded.get("authorizeParams")
    if not isinstance(params, dict) or not params:
        raise InvalidSessionState("Session state has no authorize parameters")
    if not all(isinstance(k, str) and isinstance(v, str) for k, v in params.items()):
        raise InvalidSessionState("Authorize parameters must be strings")
    for required in ("client_id", "redirect_uri"):
        if not params.get(required):
            raise InvalidSessionState("Authorize parameters are incomplete")

    return SessionState(cookies=clean_cookies, authorize_params=dict(params))


# --- HTTP client and cookies ---------------------------------------------------


def new_client(transport: httpx.AsyncBaseTransport | None = None) -> httpx.AsyncClient:
    return httpx.AsyncClient(
        timeout=httpx.Timeout(REQUEST_TIMEOUT_SECONDS, connect=CONNECT_TIMEOUT_SECONDS),
        # A redirect would hand the cookies to a host this module never vetted.
        follow_redirects=False,
        headers={"User-Agent": USER_AGENT, "Accept": "application/json, text/plain, */*"},
        transport=transport,
    )


def restore_cookies(client: httpx.AsyncClient, cookies: list[dict[str, str]]) -> None:
    for cookie in cookies:
        client.cookies.set(
            cookie["name"],
            cookie["value"],
            domain=cookie["domain"],
            path=cookie.get("path") or "/",
        )


# --- Bounded HTTP helpers --------------------------------------------------------


async def _request(
    site: Site,
    client: httpx.AsyncClient,
    method: str,
    url: str,
    *,
    form: dict[str, str] | None = None,
) -> tuple[int, bytes, str | None]:
    """Send and return (status, body, Location); body capped at MAX_RESPONSE_BYTES."""
    _require_allowed(site, url)
    headers: dict[str, str] = {}
    if method == "POST" and form is None:
        headers["Content-Type"] = "application/x-www-form-urlencoded"
    try:
        async with client.stream(method, url, data=form, headers=headers) as response:
            chunks: list[bytes] = []
            size = 0
            async for chunk in response.aiter_bytes():
                size += len(chunk)
                if size > MAX_RESPONSE_BYTES:
                    raise UpstreamError("Upstream response too large")
                chunks.append(chunk)
            return response.status_code, b"".join(chunks), response.headers.get("location")
    except httpx.HTTPError:
        # Fixed message, no chained cause: httpx errors can embed URLs.
        raise UpstreamError("Upstream request failed") from None


async def _send(
    site: Site,
    client: httpx.AsyncClient,
    url: str,
    *,
    form: dict[str, str] | None = None,
) -> tuple[int, bytes]:
    """POST and return (status, body); the body is capped at MAX_RESPONSE_BYTES."""
    status, body, _ = await _request(site, client, "POST", url, form=form)
    return status, body


async def _send_authn(
    site: Site, client: httpx.AsyncClient, url: str, form: dict[str, str]
) -> tuple[int, bytes]:
    """POST the AuthnRequest, following at most ONE 303 on the same https host.

    Observed live 2026-10-07: the servlet answers `303 Location:
    /dacsrest/api/v1u0/transaction/<ctx>` and the JSON comes from a GET there.
    A redirect to any other host, scheme or a second redirect is refused before
    anything is sent, so the SSO cookies never leave the vetted host.
    """
    status, body, location = await _request(site, client, "POST", url, form=form)
    if status != 303:
        return status, body
    if not location:
        raise UpstreamError("Authentication redirect without a location")
    target = urllib.parse.urljoin(url, location)
    source, dest = urllib.parse.urlsplit(url), urllib.parse.urlsplit(target)
    if dest.scheme != "https" or dest.netloc.lower() != source.netloc.lower():
        raise HostNotAllowed("Refused an authentication redirect to another host")
    status, body, _ = await _request(site, client, "GET", target)
    if 300 <= status < 400:
        raise UpstreamError("Authentication step redirected twice")
    return status, body


def _json_object(body: bytes) -> dict[str, Any] | None:
    try:
        decoded = json.loads(body)
    except ValueError:
        return None
    return decoded if isinstance(decoded, dict) else None


def _shape(value: Any, depth: int = 3) -> Any:
    """A JSON answer's structure for the log: key names and value types, never a value."""
    if isinstance(value, dict):
        if depth == 0:
            return f"dict[{len(value)}]"
        items = list(value.items())[:SHAPE_MAX_KEYS]
        shape = {
            ("(sensitive field)" if key in SENSITIVE_KEYS else str(key)[:40]): _shape(item, depth - 1)
            for key, item in items
        }
        if len(value) > SHAPE_MAX_KEYS:
            shape["..."] = f"+{len(value) - SHAPE_MAX_KEYS} keys"
        return shape
    if isinstance(value, list):
        return f"list[{len(value)}]"
    return type(value).__name__


@dataclass
class _Trace:
    """The last answer of a replay, for the failure log: its status and its shape."""

    status: int | None = None
    shape: Any = None


@dataclass(frozen=True)
class _SamlForm:
    request: str = field(repr=False)
    action: str


# Hops allowed between the authorize answer and a SAML request or the code: forms
# submitted and redirects followed, every one on an allow-listed host.
MAX_AUTHORIZE_HOPS = 6


def _same_endpoint(url: str, other: str) -> bool:
    a, b = urllib.parse.urlsplit(url), urllib.parse.urlsplit(other)
    return (a.scheme, (a.hostname or "").lower(), a.path) == (b.scheme, (b.hostname or "").lower(), b.path)


def _string_form(answer: Any) -> tuple[str, str, dict[str, str]] | None:
    """(method, action, fields) when `answer` is a form to submit, else None."""
    if not isinstance(answer, dict):
        return None
    action, fields = answer.get("action"), answer.get("parameters")
    if not _non_empty_str(action) or not isinstance(fields, dict) or not fields:
        return None
    if not all(isinstance(key, str) and isinstance(value, str) for key, value in fields.items()):
        return None
    method = answer.get("method") or "POST"
    return (method.upper() if isinstance(method, str) else ""), action, fields


class _HtmlFormParser(html.parser.HTMLParser):
    """The first <form> of a page: its method, action and named inputs."""

    def __init__(self) -> None:
        super().__init__()
        self.form: dict[str, Any] | None = None
        self._open = False

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = {name: value or "" for name, value in attrs}
        if tag == "form" and self.form is None:
            self.form = {"method": values.get("method") or "GET", "action": values.get("action"), "parameters": {}}
            self._open = True
        elif tag == "input" and self._open and values.get("name"):
            self.form["parameters"][values["name"]] = values.get("value", "")

    def handle_endtag(self, tag: str) -> None:
        if tag == "form":
            self._open = False


def _html_form(body: bytes, base_url: str) -> dict[str, Any] | None:
    """An auto-submitted HTML form, as the JSON form shape, its action made absolute."""
    try:
        parser = _HtmlFormParser()
        parser.feed(body.decode("utf-8", errors="replace"))
    except Exception:  # an unparsable page is no form
        return None
    form = parser.form
    if not form or not _non_empty_str(form.get("action")):
        return None
    form["action"] = urllib.parse.urljoin(base_url, form["action"])
    return form


async def _walk_to_saml_or_code(
    site: Site, client: httpx.AsyncClient, answer: dict[str, Any], redirect_uri: str, trace: _Trace
) -> "_SamlForm | str":
    """From the authorize answer to a SAML request (the historic chain) or the code.

    The answer used to hold a SAMLRequest form. Since 2026-11-24 Banque Populaire's holds
    an OAuth form for its new identity server ("iag"); the client space submits it and
    follows the redirects back. This does the same, form by form and redirect by redirect,
    on allow-listed hosts only, until a SAML request, a code addressed to the captured
    `redirect_uri`, or a code-bearing answer with no further action. A redirect to the
    login pages or a 401/403 means the SSO session is gone.
    """
    current: dict[str, Any] | None = answer
    requests_left = MAX_AUTHORIZE_HOPS
    first = True
    while True:
        fields = current.get("parameters") if isinstance(current, dict) else None
        if isinstance(fields, dict):
            saml_request = fields.get("SAMLRequest")
            if _non_empty_str(saml_request):
                return _SamlForm(request=saml_request, action=_require_allowed(site, current.get("action")))
            code = fields.get("code")
            action = current.get("action")
            if _non_empty_str(code) and (not _non_empty_str(action) or _same_endpoint(action, redirect_uri)):
                return code
        form = _string_form(current)
        if form is None:
            raise UpstreamError("Authorize step returned no SAML request" if first
                                else "Identity step returned neither a SAML request nor a code")
        first = False
        method, action, form_fields = form
        url = _require_allowed(site, action)
        if method == "GET":
            joiner = "&" if urllib.parse.urlsplit(url).query else "?"
            url, form_fields, method = url + joiner + urllib.parse.urlencode(form_fields), None, "GET"
        elif method != "POST":
            raise UpstreamError("Identity step form has an unknown method")
        while True:  # this request, then the redirects it answers with
            if requests_left == 0:
                raise UpstreamError("Identity step took too many hops")
            requests_left -= 1
            trace.shape = None
            status, body, location = await _request(site, client, method, url, form=form_fields)
            trace.status = status
            if not 300 <= status < 400:
                break
            if not location:
                raise UpstreamError("Identity step redirect without a location")
            target = _require_allowed(site, urllib.parse.urljoin(url, location))
            if _same_endpoint(target, redirect_uri):
                code = urllib.parse.parse_qs(urllib.parse.urlsplit(target).query).get("code", [None])[0]
                if _non_empty_str(code):
                    return code
                raise UpstreamError("Identity step returned to the client without a code")
            if urllib.parse.urlsplit(target).path.startswith("/se-connecter"):
                raise SessionExpired("Session no longer accepted")
            url, method, form_fields = target, "GET", None
        if status in (401, 403):
            raise SessionExpired("Session no longer accepted")
        if status != 200:
            raise UpstreamError("Identity step failed")
        current = _json_object(body)
        if current is None:
            current = _html_form(body, url)
        trace.shape = _shape(current) if current is not None else "not a JSON object"


def _non_empty_str(value: Any) -> bool:
    return isinstance(value, str) and bool(value)


def _s256_challenge(verifier: str) -> str:
    digest = hashlib.sha256(verifier.encode("ascii")).digest()
    return base64.urlsafe_b64encode(digest).decode("ascii").rstrip("=")


# --- The replay chain --------------------------------------------------------------


@dataclass(frozen=True)
class TokenResult:
    access_token: str = field(repr=False)
    expires_in: float


# The token used for accounts and transactions: the query captured at login, as is.
# The other chains (personal loan, home loan, PER) are the site's own.
MAIN_CHAIN = ChainProfile(name="main")


async def replay_chain(
    site: Site,
    state: SessionState,
    *,
    transport: httpx.AsyncBaseTransport | None = None,
    authorize_url: str | None = None,
    token_url: str | None = None,
    chain: ChainProfile = MAIN_CHAIN,
) -> TokenResult:
    """Run authorize -> AuthnRequest -> consume -> token with the session cookies.

    `chain` selects which token is minted (MAIN_CHAIN or one of the site's apps);
    the authorize and token URLs default to the site's own.

    Raises SessionExpired when the bank no longer accepts the SSO session,
    HostNotAllowed (an UpstreamError) when any URL leaves the allow-list, and
    UpstreamError for every other failure. Nothing is sent before the
    authorize/token URLs pass the allow-list.
    """
    authorize_url = site.authorize_url if authorize_url is None else authorize_url
    token_url = site.token_url if token_url is None else token_url
    _require_allowed(site, authorize_url)
    _require_allowed(site, token_url)
    params = chain.authorize_params(state.authorize_params)

    verifier = secrets.token_urlsafe(48)
    query = {
        **params,
        "code_challenge": _s256_challenge(verifier),
        "code_challenge_method": "S256",
        "nonce": secrets.token_urlsafe(24),
    }

    client = new_client(transport)
    trace = _Trace()
    try:
        restore_cookies(client, state.cookies)

        # 1. authorize
        trace.shape = None
        status, body = await _send(site, client, f"{authorize_url}?{urllib.parse.urlencode(query)}")
        trace.status = status
        authorize = _json_object(body)
        trace.shape = _shape(authorize) if authorize is not None else "not a JSON object"
        if status != 200 or authorize is None:
            raise UpstreamError("Authorize step failed")
        outcome = await _walk_to_saml_or_code(site, client, authorize, params["redirect_uri"], trace)

        if isinstance(outcome, _SamlForm):
            # 2. AuthnRequest: the status is the session-validity signal.
            trace.shape = None
            status, body = await _send_authn(site, client, outcome.action, {"SAMLRequest": outcome.request})
            trace.status = status
            if status in (401, 403):
                raise SessionExpired("Session no longer accepted")
            if status != 200:
                raise UpstreamError("Authentication step failed")
            authn = _json_object(body)
            trace.shape = _shape(authn) if authn is not None else "not a JSON object"
            authn_response = authn.get("response") if authn else None
            if not isinstance(authn_response, dict) or authn_response.get("status") != AUTHN_SUCCESS:
                raise SessionExpired("Session no longer accepted")
            saml2_post = authn_response.get("saml2_post")
            if not isinstance(saml2_post, dict):
                raise SessionExpired("Session no longer accepted")
            consume_url = _require_allowed(site, saml2_post.get("action"))
            saml_response = saml2_post.get("samlResponse")
            if not _non_empty_str(saml_response):
                raise SessionExpired("Session no longer accepted")

            # 3. consume
            trace.shape = None
            status, body = await _send(site, client, consume_url, form={"SAMLResponse": saml_response})
            trace.status = status
            consume = _json_object(body)
            trace.shape = _shape(consume) if consume is not None else "not a JSON object"
            consume_params = consume.get("parameters") if consume else None
            code = consume_params.get("code") if isinstance(consume_params, dict) else None
            if status != 200 or not _non_empty_str(code):
                raise UpstreamError("Consume step failed")
        else:
            code = outcome

        # 4. token
        trace.shape = None
        status, body = await _send(
            site,
            client,
            token_url,
            form={
                "grant_type": "authorization_code",
                "client_id": params["client_id"],
                "code": code,
                "code_verifier": verifier,
                "redirect_uri": params["redirect_uri"],
            },
        )
        trace.status = status
        token = _json_object(body)
        trace.shape = _shape(token) if token is not None else "not a JSON object"
        if status != 200 or token is None:
            raise UpstreamError("Token step failed")
        access_token = token.get("access_token")
        expires_in = token.get("expires_in")
        token_type = token.get("token_type")
        if (
            not _non_empty_str(access_token)
            or not isinstance(token_type, str)
            or token_type.lower() != "bearer"
            or isinstance(expires_in, bool)
            or not isinstance(expires_in, (int, float))
            or not 0 < expires_in <= MAX_TOKEN_LIFETIME_SECONDS
        ):
            raise UpstreamError("Token step returned an unusable token")
        return TokenResult(access_token=access_token, expires_in=expires_in)
    except ReplayError as exc:
        # The messages are fixed strings: the failed step, never upstream data.
        log.warning(
            "token replay failed: %s (%s; last HTTP status %s; last answer shape %s)",
            exc.code, exc, trace.status, trace.shape,
        )
        raise
    finally:
        await client.aclose()


# --- In-memory token cache -------------------------------------------------------------


class TokenCache:
    """Holds access tokens in memory only, until `expires_in - 30 s`.

    Keyed by a hash of the session state so neither cookies nor tokens are
    used as dictionary keys; never persisted, never logged.
    """

    def __init__(self, site: Site, clock: Callable[[], float] = time.monotonic):
        self._site = site
        self._clock = clock
        self._entries: dict[str, tuple[str, float]] = {}
        # One lock per session, so concurrent callers share a single replay chain.
        # Weak values: a lock disappears once no caller holds or awaits it.
        self._locks: weakref.WeakValueDictionary[str, asyncio.Lock] = weakref.WeakValueDictionary()

    def __len__(self) -> int:
        return len(self._entries)

    def _evict(self, now: float) -> None:
        for key in [k for k, (_, expiry) in self._entries.items() if expiry <= now]:
            del self._entries[key]
        while len(self._entries) >= MAX_CACHED_TOKENS:
            del self._entries[next(iter(self._entries))]

    @staticmethod
    def _key(state: "SessionState", chain: ChainProfile = MAIN_CHAIN) -> str:
        # The chain name is part of the key: one session holds one token per chain.
        return hashlib.sha256(
            json.dumps([chain.name, state.cookies, state.authorize_params], sort_keys=True).encode()
        ).hexdigest()

    def evict(self, raw_state: Any, *, chain: ChainProfile = MAIN_CHAIN) -> None:
        """Forget this session's token for `chain` (e.g. after the bank rejected it)."""
        self._entries.pop(self._key(parse_session_state(raw_state), chain), None)

    async def get(
        self,
        raw_state: Any,
        *,
        transport: httpx.AsyncBaseTransport | None = None,
        authorize_url: str | None = None,
        token_url: str | None = None,
        chain: ChainProfile = MAIN_CHAIN,
    ) -> TokenResult:
        state = parse_session_state(raw_state)
        key = self._key(state, chain)
        lock = self._locks.get(key)
        if lock is None:
            lock = self._locks[key] = asyncio.Lock()

        async with lock:
            now = self._clock()
            cached = self._entries.get(key)
            if cached is not None:
                token, expiry = cached
                if now < expiry - TOKEN_SAFETY_MARGIN_SECONDS:
                    return TokenResult(access_token=token, expires_in=expiry - now)
                del self._entries[key]

            result = await replay_chain(
                self._site,
                state,
                transport=transport,
                authorize_url=authorize_url,
                token_url=token_url,
                chain=chain,
            )
            now = self._clock()
            if result.expires_in > TOKEN_SAFETY_MARGIN_SECONDS:
                self._evict(now)
                self._entries[key] = (result.access_token, now + result.expires_in)
            return result
