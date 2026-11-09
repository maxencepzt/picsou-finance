"""Read-only CIC online-banking authentication and accounts sidecar.

CIC's customer site (www.cic.fr) has no public API, and PSD2 only exposes its
current accounts, not the savings accounts. Its pages are server-rendered and
its login is a plain HTML form with no captcha, so this service speaks plain
HTTPS -- no browser.

Auth flow:
  POST /initiate {login, password, sessionState?}
    → no second factor: {processId: null, mfaRequired: false, sessionState}
    → mobile confirmation: {processId, mfaRequired: true, mfaType: "APP_PUSH"}
    → code by SMS:         {processId, mfaRequired: true, mfaType: "SMS"}
  POST /complete {processId, code?}
    → APP_PUSH: holds open while the user approves in the bank's app
    → SMS: submits the code → {sessionState}
  POST /accounts {sessionState}
    → [{externalId, name, type, balanceEur, snapshotComplete}]
  POST /accounts/listing {sessionState}
    → {accounts, categoriesRead}; a securities portfolio is an account of type
      PEA or COMPTE_TITRES carrying its positions

The site runs on the same platform as Crédit Mutuel Épargne Salariale: the login
and second-factor code is the shared euro_information package's. Once the second
factor is passed, the site sets a remembered-device cookie (`auth_client_state`, 90 days on the
banking sites according to woob's `creditmutuel` module); `/initiate` accepts
the previous session and replays its whole cookie jar, as woob does. On CIC
retail banking the customer is asked to confirm again every 24 hours whatever
the cookies, so a stored-credentials re-login only gets through within a day
of the last confirmation; past that, an unattended one is withdrawn. The mobile-confirmation choreography is the
one woob documents for these sites; it is reimplemented, not copied.

Only the session cookies are returned to Java, which encrypts them before
storage. Credentials are held in memory for one request and are never logged;
neither are cookies, field values or balances.
"""

import os
from decimal import Decimal
from typing import Literal

import httpx
from euro_information.client import (
    Site,
    UpstreamError,
    auth_router,
    fetch_page,
    http_errors,
    pending_store,
    same_origin,
    with_session,
)
from picsou_sidecar import configure_logging, create_app, otp_field_detail
from pydantic import BaseModel, ConfigDict, Field

from accounts_parser import AccountKind, AccountsFormatError, parse_accounts_listing
from portfolio_parser import SYNTHESIS_PATH as PORTFOLIOS_PATH
from portfolio_parser import PortfolioKind, parse_positions, parse_synthesis

log = configure_logging("cic-auth", quiet=("httpx",))

BASE_URL = os.environ.get("CIC_BASE_URL", "https://www.cic.fr").rstrip("/")
LOGIN_PATH = "/fr/authentification.html"
ACCOUNTS_PATH = "/fr/banque/comptes-et-contrats.html"
# Where the platform's banking sites poll and cancel a mobile confirmation, per
# woob's creditmutuel module; used when the page script does not name them.
DEFAULT_STATE_PATH = "/fr/banque/async/otp/SOSD_OTP_GetTransactionState.htm"
DEFAULT_CANCEL_PATH = "/fr/banque/async/otp/SOSD_OTP_CancelTransaction.htm"

SITE = Site(
    name="CIC",
    base_url=BASE_URL,
    login_path=LOGIN_PATH,
    logged_in_marker="deconnexion/deconnexion.cgi",
    # Notices the site parks a login on until the customer acts on the website.
    action_needed_path_markers=(
        "conditions-generales",
        "paci_wsd_pdta",
        "residencefiscale",
        "migr_gestion_pouvoirs",
    ),
    skip_phrases=("passer cette etape", "passer cette étape", "plus tard"),
    # "Gestion des pouvoirs" has a "later" button, which woob presses too.
    postpone_button="_FID_DoStopPaciAndRemind",
    default_state_path=DEFAULT_STATE_PATH,
    default_cancel_path=DEFAULT_CANCEL_PATH,
)

_pending = pending_store(log)
app = create_app(
    request_log=(log, "CIC"),
    background=_pending,
    validation_detail=otp_field_detail("INVALID_OTP"),
)

app.include_router(auth_router(SITE, _pending))


# ─── Contract ───────────────────────────────────────────────────────────────


class AccountsRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    sessionState: str = Field(min_length=2, max_length=2_000_000)


class PositionPayload(BaseModel):
    """One line of a securities portfolio, shaped like the other brokerage sidecars' positions."""
    model_config = ConfigDict(extra="forbid")

    isin: str | None = Field(default=None, max_length=12)
    symbol: str = Field(min_length=1, max_length=100)
    label: str = Field(min_length=1, max_length=200)
    quantity: Decimal
    buyingPriceEur: Decimal | None = None
    currentPrice: Decimal | None = None
    quoteCurrency: str | None = Field(default=None, pattern=r"^[A-Z]{3}$")
    currentValueEur: Decimal
    pnlEur: Decimal | None = None


class AccountPayload(BaseModel):
    model_config = ConfigDict(extra="forbid")

    externalId: str = Field(min_length=1, max_length=100)
    name: str = Field(min_length=1, max_length=200)
    type: AccountKind | PortfolioKind
    balanceEur: Decimal
    # Securities portfolios only. The cash sits on its own current account, so it is zero.
    cashBalance: Decimal | None = None
    positions: list[PositionPayload] | None = None
    # A type-level assertion that a partial read can never be serialised.
    snapshotComplete: Literal[True]


class AccountsResponse(BaseModel):
    """The accounts, and which in-scope tables the page carried (an empty one included)."""
    model_config = ConfigDict(extra="forbid")

    accounts: list[AccountPayload]
    categoriesRead: list[Literal["CHECKING", "SAVINGS", "SECURITIES"]]


# ─── Accounts ───────────────────────────────────────────────────────────────


async def _accounts_page(client: httpx.AsyncClient) -> str:
    return await fetch_page(SITE, client, ACCOUNTS_PATH, "Accounts")


PORTFOLIO_NAMES = {"PEA": "PEA", "COMPTE_TITRES": "Compte titres"}


async def _collect_portfolios(client: httpx.AsyncClient) -> list[AccountPayload]:
    """Each securities portfolio with its lines, read from the portfolio pages."""
    portfolios = parse_synthesis(await fetch_page(SITE, client, PORTFOLIOS_PATH, "Portfolios"))
    payloads = []
    for portfolio in portfolios:
        detail = await fetch_page(SITE, client, same_origin(SITE, portfolio["href"]), "Portfolio")
        positions, total = parse_positions(detail, portfolio["id"])
        payloads.append(AccountPayload.model_validate({
            "externalId": f"cic_{portfolio['id']}",
            # The type's own name: the page's label carries the holder's name.
            "name": PORTFOLIO_NAMES[portfolio["type"]],
            "type": portfolio["type"],
            # The detail page's total, which its lines were checked against.
            "balanceEur": total,
            "cashBalance": Decimal(0),
            "positions": positions,
            "snapshotComplete": True,
        }))
    return payloads


async def _collect_accounts(client: httpx.AsyncClient) -> AccountsResponse:
    page = await _accounts_page(client)
    accounts, skipped, categories = parse_accounts_listing(page)
    if skipped:
        # Category names only: insurance, links to sister sites and the like.
        log.info("CIC: skipped out-of-scope categories %s", [category[:60] for category in skipped])
    # Only when the accounts page announces portfolios: a customer without any
    # is never sent to pages this sidecar has not seen empty.
    portfolios = await _collect_portfolios(client) if "SECURITIES" in categories else []
    if not accounts and not portfolios:
        raise UpstreamError("PORTFOLIO_INCOMPLETE", "No current, savings or securities account on the page")
    return AccountsResponse(
        accounts=[
            AccountPayload.model_validate({
                "externalId": f"cic_{account['id']}",
                "name": account["name"],
                "type": account["type"],
                "balanceEur": account["balanceEur"],
                "snapshotComplete": True,
            })
            for account in accounts
        ] + portfolios,
        categoriesRead=categories,
    )


# ─── Routes ─────────────────────────────────────────────────────────────────


@app.post("/accounts", response_model=list[AccountPayload], response_model_exclude_none=True)
async def accounts(req: AccountsRequest) -> list[AccountPayload]:
    """The bare list, kept for backends that predate /accounts/listing.

    Without the securities portfolios: such a backend would take one for a cash account.
    """
    return [account for account in (await _read_accounts(req)).accounts if account.positions is None]


@app.post("/accounts/listing", response_model=AccountsResponse, response_model_exclude_none=True)
async def accounts_listing(req: AccountsRequest) -> AccountsResponse:
    """The accounts and the in-scope tables the page carried, an empty one included."""
    return await _read_accounts(req)


async def _read_accounts(req: AccountsRequest) -> AccountsResponse:
    with http_errors(SITE, "accounts", AccountsFormatError, validated=True):
        return await with_session(SITE, req.sessionState, _collect_accounts)
