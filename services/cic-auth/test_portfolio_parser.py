"""The securities portfolio pages, against synthetic pages shaped like the real ones."""

import unittest
from decimal import Decimal

from accounts_parser import AccountsFormatError, parse_accounts_listing
from fixtures import (
    ACCOUNTS_PAGE, FAMILY_ACCOUNTS_PAGE, PORTFOLIO_PAGE, PORTFOLIOS_PAGE, account_row, accounts_table,
    family_accounts_page,
    family_header, portfolio_page, portfolio_row, portfolios_page, position_row, securities_total_row,
)
from portfolio_parser import parse_positions, parse_synthesis


PORTFOLIO_ID = "10000000AB00012345678"


def code_of(call, *args) -> str:
    try:
        call(*args)
    except AccountsFormatError as error:
        return error.code
    return "no error"


class FamilyLayoutTest(unittest.TestCase):
    def test_reads_the_accounts_of_a_table_cut_by_family_headers(self):
        accounts, skipped, categories = parse_accounts_listing(FAMILY_ACCOUNTS_PAGE)

        self.assertEqual([(a["id"], a["type"], a["balanceEur"]) for a in accounts],
                         [("1000000012345601", "CHECKING", Decimal("2500.00"))])
        # The securities total is neither an account nor a skipped category: the
        # portfolios are read from their own pages.
        self.assertEqual(skipped, ["assurances", "autres contrats liés"])
        self.assertEqual(categories, ["CHECKING", "SAVINGS", "SECURITIES"])

    def test_a_passbook_under_the_savings_family_is_a_savings_account(self):
        page = family_accounts_page(
            family_header("&#201;pargne") + account_row(1, "LIVRET A", "10000 000123456 02", "+5&nbsp;000,00 EUR"))

        accounts, _, categories = parse_accounts_listing(page)

        self.assertEqual([(a["type"], a["balanceEur"]) for a in accounts], [("LIVRET_A", Decimal("5000.00"))])
        self.assertEqual(categories, ["SAVINGS"])

    def test_an_account_under_financial_savings_or_an_unknown_family_fails_the_page(self):
        # Only the total row is known there: a numbered contract (a life insurance,
        # say) must not be dropped in silence.
        for rows in (
            family_header("&#201;pargne") + family_header("&#201;pargne financi&#232;re", level=2)
                + account_row(1, "CONTRAT X", "10000 000123456 05", "+9&nbsp;000,00 EUR"),
            # No other savings sub-family is known: a life insurance must not pass for a passbook.
            family_header("&#201;pargne") + family_header("Assurance vie", level=2)
                + account_row(1, "CONTRAT Y", "10000 000123456 07", "+9&nbsp;000,00 EUR"),
            family_header("Cr&#233;dits") + account_row(1, "PRET X", "10000 000123456 06", "-9&nbsp;000,00 EUR"),
        ):
            with self.subTest(rows=rows[:60]):
                self.assertEqual(code_of(parse_accounts_listing, family_accounts_page(rows)),
                                 "UPSTREAM_FORMAT_CHANGED")

    def test_a_family_header_is_told_by_its_cell_whatever_the_row_class(self):
        # A header missed would leave the next account under the previous family.
        header = '<tr><th scope="rowgroup" class="rupture"><span>Comptes courants</span></th></tr>'
        page = family_accounts_page(
            family_header("&#201;pargne") + header
            + account_row(0, "COMPTE COURANT", "10000 000123456 01", "+1,00 EUR"))

        accounts, _, categories = parse_accounts_listing(page)

        self.assertEqual([a["type"] for a in accounts], ["CHECKING"])
        self.assertEqual(categories, ["CHECKING", "SAVINGS"])

    def test_the_captioned_layout_announces_no_securities(self):
        self.assertEqual(parse_accounts_listing(ACCOUNTS_PAGE)[2], ["CHECKING", "SAVINGS"])
        # Even a caption that happens to carry the family layout's internal name.
        page = ACCOUNTS_PAGE.replace("</form>", accounts_table("Portefeuilles titres", "") + "</form>")
        self.assertEqual(parse_accounts_listing(page)[2], ["CHECKING", "SAVINGS"])


class SynthesisTest(unittest.TestCase):
    def test_lists_each_portfolio_with_its_detail_link_and_type(self):
        page = portfolios_page(
            portfolio_row("10000&nbsp;000AB&nbsp;00012345678", "Compte titres", "3&nbsp;650,00")
            + portfolio_row("10000&nbsp;000AB&nbsp;00012345679", "PEA", "1&nbsp;000,50", query="ddp=other&amp;x=1"),
            "4&nbsp;650,50")

        self.assertEqual(parse_synthesis(page), [
            {"id": "10000000AB00012345678", "type": "COMPTE_TITRES",
             "href": "https://www.cic.fr/fr/banque/PORT_Valo.aspx?ddp=opaque", "valuationEur": Decimal("3650.00")},
            {"id": "10000000AB00012345679", "type": "PEA",
             "href": "https://www.cic.fr/fr/banque/PORT_Valo.aspx?ddp=other&x=1", "valuationEur": Decimal("1000.50")},
        ])

    def test_a_link_written_relative_to_the_page_is_resolved(self):
        # What the live site sends; a page saved from a browser carries the absolute form.
        for href in ("PORT_Valo.aspx?ddp=opaque", "/fr/banque/PORT_Valo.aspx?ddp=opaque", " PORT_Valo.aspx?ddp=opaque"):
            with self.subTest(href=href):
                page = PORTFOLIOS_PAGE.replace("https://www.cic.fr/fr/banque/PORT_Valo.aspx?ddp=opaque", href)
                self.assertEqual(parse_synthesis(page)[0]["href"], "/fr/banque/PORT_Valo.aspx?ddp=opaque")
        # Relative to the page too, but another page.
        page = PORTFOLIOS_PAGE.replace("https://www.cic.fr/fr/banque/PORT_Valo.aspx", "../PORT_Valo.aspx")
        self.assertEqual(code_of(parse_synthesis, page), "UPSTREAM_FORMAT_CHANGED")

    def test_the_type_is_read_from_the_product_label_not_the_holder_name(self):
        page = portfolios_page(portfolio_row("1", "Compte titres&nbsp;M PEA", "1,00"), "1,00")

        self.assertEqual(parse_synthesis(page)[0]["type"], "COMPTE_TITRES")

    def test_portfolios_that_do_not_add_up_to_the_total_are_refused(self):
        page = portfolios_page(portfolio_row("10000 000AB 1", "Compte titres", "3&nbsp;650,00"), "9&nbsp;999,00")

        self.assertEqual(code_of(parse_synthesis, page), "PORTFOLIO_INCOMPLETE")

    def test_a_changed_page_is_refused(self):
        cases = {
            "no table": PORTFOLIOS_PAGE.replace('id="tabSYNT"', 'id="other"'),
            "no total": PORTFOLIOS_PAGE.replace('id="TdTotalValorisationEur"', 'id="x"'),
            "no detail link": PORTFOLIOS_PAGE.replace("PORT_Valo.aspx", "PORT_Other.aspx"),
            # Fetched with the session: only the detail page itself, not a link mentioning it.
            "another page": PORTFOLIOS_PAGE.replace("PORT_Valo.aspx?ddp=opaque",
                                                    "virement.aspx?x=/fr/banque/PORT_Valo.aspx"),
            "one-cell total": PORTFOLIOS_PAGE.replace('<td id="TdTotalValorisationEur" class="tot mtt">3&nbsp;650,00</td>', "")
                                             .replace('<td class="tittot d">TOTAL', '<td id="TdTotalValorisationEur">TOTAL')
                                             .replace('<td id="TdTotalPlusMoinsValueEur" class="tot mtt fh">+150,00</td>', "")
                                             .replace('<td id="TdTotalPlusMoinsValuePourcentage" class="tot mtt fh">+4,29&nbsp;%</td>', ""),
            "same number twice": portfolios_page(portfolio_row("1", "PEA", "1,00") * 2, "2,00"),
            "cut short": PORTFOLIOS_PAGE.replace("</html>", ""),
        }
        for name, page in cases.items():
            with self.subTest(name):
                self.assertEqual(code_of(parse_synthesis, page), "UPSTREAM_FORMAT_CHANGED")


class PositionsTest(unittest.TestCase):
    def test_reads_each_line_and_the_total(self):
        positions, total = parse_positions(PORTFOLIO_PAGE, PORTFOLIO_ID)

        self.assertEqual(total, Decimal("3650.00"))
        self.assertEqual(positions, [
            {"isin": "US0000000001", "symbol": "US0000000001", "label": "ACME CORP", "quantity": Decimal("10"),
             "buyingPriceEur": Decimal("100.00"), "currentPrice": Decimal("123.45"), "quoteCurrency": "USD",
             "currentValueEur": Decimal("1150.00"), "pnlEur": Decimal("150.00")},
            {"isin": "FR0000000002", "symbol": "FR0000000002", "label": "EXAMPLE WORLD ETF",
             "quantity": Decimal("25.5"), "buyingPriceEur": Decimal("100.00"), "currentPrice": Decimal("98.04"),
             "quoteCurrency": "EUR", "currentValueEur": Decimal("2500.00"), "pnlEur": Decimal("-50.00")},
        ])

    def test_lines_that_do_not_add_up_to_the_total_are_refused(self):
        # A line the parser missed must fail the read, never shorten the portfolio.
        self.assertEqual(code_of(parse_positions, portfolio_page(
            position_row(1, "ACME CORP", "US0000000001", "10", "1,00&nbsp;EUR", "1,00", "10,00", "+0,00"), "99,00"),
            PORTFOLIO_ID), "PORTFOLIO_INCOMPLETE")

    def test_a_row_of_an_unknown_kind_carrying_figures_is_refused(self):
        page = PORTFOLIO_PAGE.replace(' class=" ligneMere"', ' class=" ligneFille"', 1)

        self.assertEqual(code_of(parse_positions, page, PORTFOLIO_ID), "UPSTREAM_FORMAT_CHANGED")

    def test_a_figure_is_read_whole_or_refused(self):
        # A prefix read would turn "10 2024" into 102024 and "1.150,00" into 1,
        # and a single line would still reconcile with a total misread the same way.
        row = lambda **cells: position_row(1, "ACME CORP", "US0000000001", **{
            "quantity": "10", "price": "1,00&nbsp;EUR", "unit_cost": "1,00", "value": "10,00", "gain": "+0,00", **cells})
        for name, cells in {
            "quantity then another number": {"quantity": "10 2024"},
            "dotted thousands": {"value": "1.150,00"},
            "unit cost that is a date": {"unit_cost": "02/01/2026"},
            "gain with a unit": {"gain": "+0,00 EUR"},
        }.items():
            with self.subTest(name):
                self.assertEqual(code_of(parse_positions, portfolio_page(row(**cells), "10,00"), PORTFOLIO_ID),
                                 "UPSTREAM_FORMAT_CHANGED")

    def test_the_unit_cost_is_the_second_line_whatever_follows_the_price(self):
        page = portfolio_page(position_row(
            1, "ACME CORP", "US0000000001", "10", "1,00&nbsp;EUR</span><span>02/01/2026", "0,90", "10,00",
            "\u2212&nbsp;1,00"), "10,00")

        position = parse_positions(page, PORTFOLIO_ID)[0][0]

        self.assertEqual((position["buyingPriceEur"], position["pnlEur"]), (Decimal("0.90"), Decimal("-1.00")))

    def test_a_price_without_a_currency_is_left_out_but_the_line_is_kept(self):
        page = portfolio_page(position_row(
            1, "EXAMPLE BOND", "FR0000000003", "1&nbsp;000", "99,5&nbsp;%", "98,00", "995,00", "+15,00"), "995,00")

        position = parse_positions(page, PORTFOLIO_ID)[0][0]

        self.assertEqual((position["quantity"], position["currentPrice"], position["quoteCurrency"],
                          position["buyingPriceEur"]), (Decimal("1000"), None, None, Decimal("98.00")))

    def test_the_page_of_another_portfolio_is_refused(self):
        self.assertEqual(code_of(parse_positions, PORTFOLIO_PAGE, "10000000AB00012345679"),
                         "UPSTREAM_FORMAT_CHANGED")

    def test_an_empty_portfolio_is_valid(self):
        self.assertEqual(parse_positions(portfolio_page("", "0,00"), PORTFOLIO_ID), ([], Decimal("0.00")))

    def test_a_changed_page_is_refused(self):
        cases = {
            "no table": PORTFOLIO_PAGE.replace('id="tabValorisation"', 'id="other"'),
            "no total": PORTFOLIO_PAGE.replace('class="tittot"', 'class="other"'),
            "unreadable quantity": PORTFOLIO_PAGE.replace("<span>10 <br>", "<span>n/a <br>"),
            "cut short": PORTFOLIO_PAGE.replace("</html>", ""),
        }
        for name, page in cases.items():
            with self.subTest(name):
                self.assertEqual(code_of(parse_positions, page, PORTFOLIO_ID), "UPSTREAM_FORMAT_CHANGED")


if __name__ == "__main__":
    unittest.main()
