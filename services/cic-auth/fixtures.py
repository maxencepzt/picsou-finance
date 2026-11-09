"""Synthetic pages shaped like the CIC customer site, with made-up names and amounts.

The markup keeps the classes, captions and nesting the parsers rely on, copied
from real pages; nothing else of them is kept.
"""

from euro_information.testing import transaction_state, wrong_password_page  # noqa: F401

LOGOUT_LINK = '<a href="/fr/identification/deconnexion/deconnexion.cgi">Déconnexion</a>'

LOGIN_PAGE = """
<html><body>
<form method="post" autocomplete="off" name="bloc_ident" id="bloc_ident">
  <input type="text" id="_userid" name="_cm_user" value="" />
  <input type="hidden" name="flag" value="password">
  <input type="hidden" name="_charset_">
  <input type="password" name="_cm_pwd" id="_pwduser" />
</form>
</body></html>
"""

LOGIN_PAGE_WRONG_PASSWORD = wrong_password_page(LOGIN_PAGE)


def account_row(index: int, title: str, number: str, amount: str) -> str:
    return f"""
<tr id="I0:ac.s1.A1:al.A:F_{index}.A1:T0" class="_c1 _c1">
<td colspan="1" class="_c1 decal1 _c1"><a href="https://www.cic.fr/fr/banque/mouvements.html?webid=0a1b2c{index}" target="_self">
<span><span class="_c1 ei_sdsf_title _c1">{title}</span> <span class="_c1 nowrap _c1">M JOHN DOE</span> <span>-</span>
<span class="_c1 nowrap doux _c1">{number}</span></span></a></td>
<td class="d nowrap "></td><td class="d nowrap ei_sdsf_solde"><span class="ei_sdsf_montant pos">{amount}</span></td>
<td class="ei_actionsblock"><button type="button" title="Actions liées au {title}">Actions</button></td>
</tr>"""


def accounts_table(category: str, rows: str) -> str:
    return f"""
<table id="I0:ac.T" class="_c1 ei_comptescontrats _c1 liste ei_cellspacing" style="width:100%;">
<caption class="invisible"><span class="invisible">Liste des comptes li&#233;s &#224; la cat&#233;gorie : {category}</span></caption>
<thead><tr class="_c1 ei_headList-invisible _c1"><th>Contrat</th><th>D&#233;bit</th><th>Cr&#233;dit</th><th>Actions</th></tr></thead>
<tbody>{rows}</tbody></table>"""


OTHER_CONTRACTS = """
<table class="_c1 ei_comptescontrats _c1 liste ei_cellspacing">
<caption class="invisible"><span class="invisible">Liste des comptes li&#233;s &#224; la cat&#233;gorie : Autres contrats li&#233;s</span></caption>
<tbody><tr id="x"><td><a href="https://www.cic.fr/fr/banque/lien_inter_sites_multibanque.html?action=access&amp;d=CICCMESPAR">XXXX1234 Épargne Retraite Entreprises</a></td><td></td></tr></tbody></table>"""

ACCOUNTS_PAGE = f"""
<html><body>{LOGOUT_LINK}
<form id="I0:P:F" action="/fr/banque/comptes-et-contrats.html?_tabi=I0&amp;_pid=AccountsAndContracts" method="post">
{accounts_table("Comptes courants", account_row(0, "COMPTE COURANT", "10000 000123456 01", "+1&nbsp;234,56 EUR"))}
{accounts_table("Livrets et comptes d&#39;épargne",
    account_row(1, "LIVRET A", "10000 000123456 02", "+5&nbsp;000,00 EUR")
    + account_row(2, "LIVRET DE DEVELOPPEMENT DURABLE SOLIDAIRE", "10000 000123456 03", "+800,00 EUR")
    + account_row(3, "PLAN EPARGNE LOGEMENT", "10000 000123456 04", "+3&nbsp;100,50 EUR"))}
{OTHER_CONTRACTS}
</form></body></html>"""

MOBILE_CONFIRMATION_PAGE = """
<html><body>
<form id="C:P:F" action="/fr/banque/validation.aspx?_tabi=C&amp;_pid=OtpValidationPage" method="post">
  <input name="$CPT" type="hidden" value="opaque-page-state" />
  <input type="submit" name="_FID_DoValidate" value="Continuer" class="hideifscript" />
  <div id="C:inMobileAppMessage"><h2>Une demande de confirmation mobile a &#233;t&#233; transmise &#224; votre appareil.</h2>
  <p>D&#233;marrez votre application mobile CIC pour v&#233;rifier et confirmer cette op&#233;ration.</p></div>
</form>
<script type="text/javascript">
  $dv.O('C:P:polling', 'OtpPolling', {transactionId: '0123456789abcdef0123456789abcdef0123456789abcdef0', getTransactionState: true});
</script>
</body></html>
"""

SMS_CONFIRMATION_PAGE = """
<html><body>
<form id="C:P:F" action="/fr/banque/validation.aspx?_tabi=C&amp;_pid=OtpValidation" method="post">
  <div id="C:OTPDeliveryChannelText">Un code de confirmation vous a été envoyé par SMS au 06 XX XX XX 12.</div>
  <input type="hidden" name="otp_hidden" value="opaque-otp-state" />
  <input type="text" name="otp_password" maxlength="6" />
  <input type="submit" name="_FID_CheckOrDeliverBackup" value="Valider" />
  <input name="$CPT" type="hidden" value="opaque-page-state" />
</form>
</body></html>
"""

AUTHORITY_MANAGEMENT_PAGE = """
<html><body>
<form id="C:P:F" action="/fr/banque/migr_gestion_pouvoirs.html?_tabi=C" method="post">
  <p>Votre contrat de Banque à distance évolue et vous permet désormais de gérer électroniquement les pouvoirs.</p>
  <input name="$CPT" type="hidden" value="opaque-page-state" />
  <input type="submit" name="_FID_DoStopPaciAndRemind" value="Plus tard" />
</form>
</body></html>
"""



# ─── Family layout and securities portfolios (Banque Transatlantique) ────────


# Made-up amounts shared by the pages below, which must agree with one another.
PORTFOLIO_TOTAL = "3&nbsp;650,00"
SECOND_PORTFOLIO_TOTAL = "10,00"


def family_header(name: str, *, level: int = 1) -> str:
    rupture = "rupture" if level == 1 else f"rupture{level}"
    return (f'<tr id="I0:s1.A1:al.F_{level}.T1" class="ei_rupture ___TrExpander">'
            f'<th scope="rowgroup" colspan="4" class="{rupture} eir_tblshowth"><span>{name}</span></th></tr>')


def securities_total_row(amount: str) -> str:
    return f"""
<tr class="_c1 _c1"><td colspan="1" class="decalrupt2 _c1 p decal1 ei_sdsf_title-withRefLink _c1">
<a href="https://www.cic.fr/fr/banque/SYNT_AccueilBourse.aspx?webid=0a1b2c" target="_self">
<span><span class="_c1 ei_sdsf_title _c1">Valorisation totale de vos portefeuilles titres</span> </span></a>
<a href="#1" name="r1" class="renvoi"><span class="ei_sronly">Note de bas de page :</span> 1</a></td>
<td class="d nowrap _c1 p _c1"></td>
<td class="d nowrap _c1 p ei_sdsf_solde _c1"><span class="ei_sdsf_montant _c1 pos _c1">{amount}</span></td>
<td class="a_actions nowrap _c1 p _c1"></td></tr>"""


def family_accounts_page(rows: str) -> str:
    return f"""
<html><body>{LOGOUT_LINK}
<table id="I0:s2.A2:al.T4" role="presentation" class="_c1 ei_comptescontrats _c1" style="width:100%;">
<caption class="invisible"><span class="invisible"><span>Liste de Comptes et contrats</span> <span>Tri par famille</span></span></caption>
<tr><th scope="col"><span class="invisible">Contrat</span></th><th scope="col"><span class="invisible">D&#233;bit</span></th>
<th scope="col"><span class="invisible">Cr&#233;dit</span></th><th scope="col"><span class="invisible">Actions</span></th></tr>
{rows}
{family_header("Assurances")}
<tr><td colspan="4" class="decalrupt1"><a role="button" href="#"><span class="ei_sdsf_title">Vos contrats et nos offres</span></a></td></tr>
{family_header("Autres contrats li&#233;s")}
<tr><td colspan="4"><p>Vous pouvez ajouter &#224; cette page un acc&#232;s rapide vers d'autres contrats.</p></td></tr>
</table></body></html>"""


FAMILY_ACCOUNTS_PAGE = family_accounts_page(
    family_header("Comptes courants")
    + account_row(0, "COMPTE GERE ESPECE", "10000 000123456 01", "+2&nbsp;500,00 EUR")
    + family_header("&#201;pargne")
    + family_header("&#201;pargne financi&#232;re", level=2)
    + securities_total_row(f"+{PORTFOLIO_TOTAL} EUR"))


def portfolio_row(number: str, label: str, valuation: str, *, query: str = "ddp=opaque") -> str:
    return f"""
<tr niveauligne="1" tri-complet="2" data-filtre=""><td>&nbsp;<span class="ei_gly_ic_explore" title="Gestion Sous Mandat"></span>
<a class="nowrap fg" href="https://www.cic.fr/fr/banque/PORT_Valo.aspx?{query}">{number}</a>&nbsp;{label}&nbsp;M JOHN DOE
<span style="float: right">{valuation} EUR</span><span class="fd"><em>Gestion Sous Mandat&nbsp;</em></span></td>
<td class="d" style="vertical-align: top">{valuation}</td><td class="d fh">+150,00</td><td class="d fh">+4,29&nbsp;%</td></tr>"""


def portfolios_page(rows: str, total: str) -> str:
    return f"""
<html><body>{LOGOUT_LINK}
<table id="tabSYNT" class="over liste" couleuralternee="none">
<thead><tr niveauligne="1" id="ligEntete"><th scope="col"><span>Portefeuille</span></th>
<th scope="col"><span>Valorisation&nbsp;en&nbsp;EUR&nbsp;</span><a class="renvoi" href="#n1">1</a></th>
<th scope="col"><span>+/- Value latente&nbsp;en&nbsp;EUR&nbsp;</span></th><th scope="col"><span>+/- Value latente&nbsp;en %</span></th></tr></thead>
<tbody>{rows}
<tr niveauligne="1" tri-complet="3" data-filtre=""><td class="tittot d">TOTAL VALORISATION TITRES</td>
<td id="TdTotalValorisationEur" class="tot mtt">{total}</td><td id="TdTotalPlusMoinsValueEur" class="tot mtt fh">+150,00</td>
<td id="TdTotalPlusMoinsValuePourcentage" class="tot mtt fh">+4,29&nbsp;%</td></tr></tbody><tfoot></tfoot></table>
</body></html>"""


PORTFOLIOS_PAGE = portfolios_page(
    portfolio_row("10000&nbsp;000AB&nbsp;00012345678", "Compte titres", PORTFOLIO_TOTAL), PORTFOLIO_TOTAL)
TWO_PORTFOLIOS_PAGE = portfolios_page(
    portfolio_row("10000&nbsp;000AB&nbsp;00012345678", "Compte titres", PORTFOLIO_TOTAL)
    + portfolio_row("10000&nbsp;000AB&nbsp;00012345679", "PEA", SECOND_PORTFOLIO_TOTAL, query="ddp=second"), "3&nbsp;660,00")


def position_row(index: int, name: str, isin: str, quantity: str, price: str, unit_cost: str,
                 value: str, gain: str) -> str:
    return f"""
<tr niveauligne="1" id="{index}" class=" ligneMere" tri-thvaleurs="{name}" tri-complet="{index}" data-filtre="">
<td id="CelValDet{index}" class="p"><div><a href="https://www.cic.fr/fr/banque/VALE_Fiche.aspx?v={index}" title="Fiche valeur">{name}</a></div>
<div><span>{isin}</span></div></td>
<td class="d p"><span>{quantity} <br><span id="Status" class="ei_statustag ei_statustag--neutral" title="Mode de d&#233;tention">Nominatif</span></span></td>
<td class="d p"><div><p><span><span>{price}&nbsp;</span><span class="ei_gly_ic_event b"><span class="invisible" title="Cours en diff&#233;r&#233;"></span></span></span></p></div>
<div><p>{unit_cost}</p></div></td>
<td id="celValMntPrct{index}" class="d p"><div><p>{value}</p></div><div><p>31,51&nbsp;%</p></div></td>
<td id="cellValoPlsMoin{index}" class="d p"><div><p class="fh">{gain}</p></div><div><p>+15,00&nbsp;%</p></div></td>
<td class="vc c p"><div class="a_actions"><a href="#" class="act popmenu" role="button"><span>Actions</span></a></div></td></tr>"""


def portfolio_page(rows: str, total: str, *, number: str = "10000 000AB 00012345678") -> str:
    return f"""
<html><body>{LOGOUT_LINK}
<table class="fiche" id="TabSurVol"><tr><td class="g"><span>{number}</span></td>
<td class="d"><span class="ei_sdsf_montant">{total} EUR</span></td></tr></table>
<table id="affichage1" role="presentation"><tr><td>A la date du 02/01/2026 Cours de valorisation Cours en temps diff&#233;r&#233;</td></tr></table>
<table id="tabValorisation" class="liste" couleuralternee="normal">
<thead><tr niveauligne="1" id="lgEntetValo"><th id="thValeurs" scope="col"><span>Valeur</span></th>
<th id="thQuantMnt" scope="col"><span>Quantit&#233; / Montant nominal</span></th>
<th id="thCours" scope="col"><span>Cours <a class="renvoi" href="#n1">1</a></span><br><span>Prix de revient en EUR <a class="renvoi" href="#n2">2</a></span></th>
<th id="thValo" scope="col"><span>Valorisation&nbsp;en&nbsp;EUR&nbsp;<br>R&#233;partition en %</span></th>
<th id="thPlusMoinsLatente" scope="col"><span>+/- Value latente en EUR<br>+/- Value latente en %</span><a class="renvoi" href="#n3">3</a></th>
<th id="thActions" scope="col"><span>Action</span></th></tr></thead>
<tbody>{rows}
<tr niveauligne="1" id="lignePied"> </tr>
<tr niveauligne="1" class="tittot"><td class="tittot d" colspan="3"><span id="spanTot">Total</span></td>
<td class="tittot d"><div><span>{total}</span></div><div><span>100,00&nbsp;%</span></div></td>
<td class="tittot d"><div><p class="fh">+150,00</p></div><div><p>+4,29&nbsp;%</p></div></td><td class="tittot d"></td></tr>
</tbody></table></body></html>"""


PORTFOLIO_PAGE = portfolio_page(
    position_row(1, "ACME CORP", "US0000000001", "10", "123,45&nbsp;USD", "100,00", "1&nbsp;150,00", "+150,00")
    + position_row(2, "EXAMPLE WORLD ETF", "FR0000000002", "25,5", "98,04&nbsp;EUR", "100,00", "2&nbsp;500,00", "-50,00"),
    PORTFOLIO_TOTAL)
SECOND_PORTFOLIO_PAGE = portfolio_page(
    position_row(1, "ACME CORP", "US0000000001", "1", "10,00&nbsp;EUR", "9,00", SECOND_PORTFOLIO_TOTAL, "+1,00"),
    SECOND_PORTFOLIO_TOTAL, number="10000 000AB 00012345679")
