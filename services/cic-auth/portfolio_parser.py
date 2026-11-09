"""Parse the securities portfolios of the customer site.

Two pages, both server-rendered:

`/fr/banque/SYNT_Synthese.aspx` lists the portfolios, one row each, then a total:

    <table id="tabSYNT">
      <tr><td><a href="…/PORT_Valo.aspx?ddp=…">10000 000AB 00012345678</a> Compte titres M JOHN DOE …</td>
          <td class="d">12 345,67</td> …</tr>
      <tr><td class="tittot d">TOTAL VALORISATION TITRES</td>
          <td id="TdTotalValorisationEur">12 345,67</td> …</tr>

`/fr/banque/PORT_Valo.aspx` lists the lines of one portfolio, then a total:

    <table id="tabValorisation">
      <tr class=" ligneMere">
        <td><div><a>ACME CORP</a></div><div><span>US0000000001</span></div></td>
        <td class="d p"><span>10 </span></td>                     quantity
        <td class="d p"><div>…123,45 USD…</div><div>…100,00…</div></td>   price, unit cost in EUR
        <td class="d p"><div>1 150,00</div><div>9,31 %</div></td>  value in EUR
        <td class="d p"><div>+150,00</div><div>+15,00 %</div></td> latent gain in EUR
        <td>…</td></tr>
      <tr class="tittot"><td colspan="3">Total</td><td>…12 345,67…</td> …</tr>

Each page is checked against its own total, to the cent: a line the parser
missed must fail the read, never shorten the portfolio. Any row it does not
recognize fails too. A figure is the first text of its cell, read whole: "1 150"
followed by anything but the end is refused, never read as a longer number. The
detail page must name the portfolio it was fetched for.
"""

import html
import re
from decimal import Decimal, InvalidOperation
from typing import Literal
from urllib.parse import urlsplit

from accounts_parser import FORMAT_CHANGED, AccountsFormatError, _DOCUMENT_END_RE, _fold, _PageParser, _text

INCOMPLETE = "PORTFOLIO_INCOMPLETE"

PortfolioKind = Literal["PEA", "COMPTE_TITRES"]

_TABLE_RE = r'<table\b[^>]*\bid="{id}"[^>]*>(?P<body>.*?)</table>'
_ROW_RE = re.compile(r"<tr\b(?P<attrs>[^>]*)>(?P<row>.*?)</tr>", re.DOTALL | re.IGNORECASE)
_CELL_RE = re.compile(r"<td\b(?P<attrs>[^>]*)>(?P<cell>.*?)</td>", re.DOTALL | re.IGNORECASE)
_LINK_RE = re.compile(r'<a\b[^>]*\bhref="(?P<href>[^"]+)"[^>]*>(?P<text>.*?)</a>', re.DOTALL | re.IGNORECASE)
_DIV_RE = re.compile(r"<div\b[^>]*>(?P<div>.*?)</div>", re.DOTALL | re.IGNORECASE)
_TEXT_NODE_RE = re.compile(r">([^<>]+)<")
# French figures: thousands grouped by a space or not grouped at all, a decimal comma.
_NUMBER = r"[+-]?\s?(?:\d{1,3}(?:\s\d{3})+|\d+)(?:,\d+)?"
_NUMBER_RE = re.compile(_NUMBER)
_PRICE_RE = re.compile(rf"(?P<price>{_NUMBER})\s(?P<currency>[A-Z]{{3}})")
_ISIN_RE = re.compile(r"\b[A-Z]{2}[A-Z0-9]{9}\d\b")
# Anchored on the product label, which comes first: the holder's name follows it.
_PEA_RE = re.compile(r"PEA\b|PLAN D'EPARGNE EN ACTIONS")
DETAIL_PATH = "/fr/banque/PORT_Valo.aspx"


def _error(message: str, code: str = FORMAT_CHANGED) -> AccountsFormatError:
    return AccountsFormatError(code, message)


def _plain(fragment: str) -> str:
    """Visible text with every kind of space folded to a plain one."""
    return re.sub(r"\s+", " ", _text(fragment)).strip()


def _first_text(fragment: str) -> str:
    """The first text of a cell: its figure, before any unit, status or second line."""
    for node in _TEXT_NODE_RE.finditer(f">{fragment}<"):
        text = re.sub(r"\s+", " ", html.unescape(node.group(1))).strip().replace("\u2212", "-")
        if text:
            return text
    return ""


def _decimal(raw: str, what: str) -> Decimal:
    try:
        return Decimal(re.sub(r"\s", "", raw).replace(",", "."))
    except InvalidOperation as exc:
        raise _error(f"Unreadable {what}") from exc


def _first_number(fragment: str, what: str) -> Decimal:
    text = _first_text(fragment)
    if _NUMBER_RE.fullmatch(text) is None:
        raise _error(f"Unreadable {what}")
    return _decimal(text, what)


def _table(page: str, table_id: str, what: str) -> str:
    if _DOCUMENT_END_RE.search(page) is None:
        raise _error(f"Incomplete {what} page")
    tables = re.findall(_TABLE_RE.format(id=table_id), _PageParser(page).visible_html(), re.DOTALL | re.IGNORECASE)
    if len(tables) != 1:
        raise _error(f"No single {what} table")
    return tables[0]


def _portfolio(cells: list[str], seen: list[dict]) -> dict:
    link = _LINK_RE.search(cells[0])
    # The exact page, not a link merely mentioning it: it is fetched with the session.
    if link is None or urlsplit(html.unescape(link.group("href"))).path != DETAIL_PATH:
        raise _error("A portfolio row has no detail link")
    portfolio_id = re.sub(r"[^0-9A-Za-z]", "", _plain(link.group("text")))
    if not portfolio_id or any(portfolio["id"] == portfolio_id for portfolio in seen):
        raise _error("A portfolio row has no unique number")
    label = _fold(_plain(_LINK_RE.sub("", cells[0], count=1)))
    return {
        "id": portfolio_id,
        "type": "PEA" if _PEA_RE.match(label) else "COMPTE_TITRES",
        "href": html.unescape(link.group("href")),
        "valuationEur": _first_number(cells[1], "portfolio valuation"),
    }


def parse_synthesis(page: str) -> list[dict]:
    """The portfolios: {id, type, href, valuationEur}, checked against the page's total."""
    portfolios: list[dict] = []
    total: Decimal | None = None
    for row in _ROW_RE.finditer(_table(page, "tabSYNT", "portfolios")):
        cells = [cell.group("cell") for cell in _CELL_RE.finditer(row.group("row"))]
        if not cells:
            continue  # the header row
        if len(cells) < 2:
            raise _error("A portfolios row has too few cells")
        if 'id="TdTotalValorisationEur"' in row.group("row"):
            total = _first_number(cells[1], "portfolios total")
        else:
            portfolios.append(_portfolio(cells, portfolios))
    if total is None:
        raise _error("No total on the portfolios page")
    if sum((portfolio["valuationEur"] for portfolio in portfolios), Decimal(0)) != total:
        raise _error("The portfolios do not add up to the page's total", INCOMPLETE)
    return portfolios


def _position(cells: list[str]) -> dict:
    if len(cells) < 5:
        raise _error("A position row has too few cells")
    link = _LINK_RE.search(cells[0])
    label = _plain(link.group("text") if link else cells[0])
    isin = _ISIN_RE.search(_plain(cells[0]))
    if not label:
        raise _error("A position row has no name")
    # Two lines: the price with its currency, then the unit cost in EUR. A price
    # with no currency (a bond quoted in %) is left out; the unit cost is still read.
    lines = [line.group("div") for line in _DIV_RE.finditer(cells[2])] or [cells[2]]
    price = _PRICE_RE.fullmatch(_first_text(lines[0]))
    unit_cost = _first_text(lines[1]) if len(lines) > 1 else ""
    if unit_cost and _NUMBER_RE.fullmatch(unit_cost) is None:
        raise _error("Unreadable unit cost")
    return {
        "isin": isin.group(0) if isin else None,
        "symbol": isin.group(0) if isin else label[:100],
        "label": label[:200],
        "quantity": _first_number(cells[1], "position quantity"),
        "buyingPriceEur": _decimal(unit_cost, "unit cost") if unit_cost else None,
        "currentPrice": _decimal(price.group("price"), "price") if price else None,
        "quoteCurrency": price.group("currency") if price else None,
        "currentValueEur": _first_number(cells[3], "position value"),
        "pnlEur": _first_number(cells[4], "position gain") if _first_text(cells[4]) else None,
    }


def parse_positions(page: str, portfolio_id: str) -> tuple[list[dict], Decimal]:
    """The lines of one portfolio and its total, the lines checked against it to the cent.

    The page must name `portfolio_id`: a site that answered another portfolio's
    page would otherwise give two accounts the same lines.
    """
    if portfolio_id not in re.sub(r"[^0-9A-Za-z]", "", _text(_PageParser(page).visible_html())):
        raise _error("The portfolio page is not the one asked for")
    positions: list[dict] = []
    total: Decimal | None = None
    for row in _ROW_RE.finditer(_table(page, "tabValorisation", "portfolio")):
        cells = [cell.group("cell") for cell in _CELL_RE.finditer(row.group("row"))]
        classes = set(re.findall(r'class="([^"]*)"', row.group("attrs"))[0].split()) if 'class="' in row.group("attrs") else set()
        if "ligneMere" in classes:
            positions.append(_position(cells))
        elif "tittot" in classes:
            if len(cells) < 2:
                raise _error("The portfolio total row has no amount")
            total = _first_number(cells[1], "portfolio total")
        elif cells and re.search(r"\d", _plain(row.group("row"))):
            # A row kind this parser does not know, carrying figures: do not guess.
            raise _error("An unrecognized row in the portfolio table")
    if total is None:
        raise _error("No total on the portfolio page")
    if sum((position["currentValueEur"] for position in positions), Decimal(0)) != total:
        raise _error("The positions do not add up to the portfolio's total", INCOMPLETE)
    return positions, total
