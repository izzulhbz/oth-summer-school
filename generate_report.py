"""
Generate a PDF analysis report for the OTH Summer School Voting Smart Contract.
"""
import os
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.lib.colors import HexColor, black, white
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, PageBreak, KeepTogether
)
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.platypus import Preformatted

# ── Colour palette ────────────────────────────────────────────────
DARK_BLUE  = HexColor("#1a237e")
MID_BLUE   = HexColor("#283593")
ACCENT     = HexColor("#42a5f5")
GREEN      = HexColor("#2e7d32")
LIGHT_BG   = HexColor("#f5f5f5")
CODE_BG    = HexColor("#263238")
CODE_FG    = HexColor("#cfd8dc")
WARN       = HexColor("#e65100")
GREY       = HexColor("#616161")
PASS_GREEN = HexColor("#e8f5e9")
PASS_BORDER= HexColor("#43a047")
WARN_BG    = HexColor("#fff8e1")
WARN_BORDER= HexColor("#ffb300")
RED        = HexColor("#b71c1c")

OUTPUT_PATH = r"C:\Users\ualqa\Downloads\BC\oth-summer-school\Voting_Contract_Analysis_Report.pdf"

PAGE_W, PAGE_H = A4
MARGIN = 2 * cm

def build_styles():
    base = getSampleStyleSheet()

    styles = {}

    styles["title"] = ParagraphStyle(
        "title", fontSize=26, leading=32, fontName="Helvetica-Bold",
        textColor=white, alignment=TA_CENTER, spaceAfter=6
    )
    styles["subtitle"] = ParagraphStyle(
        "subtitle", fontSize=12, leading=16, fontName="Helvetica",
        textColor=HexColor("#bbdefb"), alignment=TA_CENTER, spaceAfter=0
    )
    styles["h1"] = ParagraphStyle(
        "h1", fontSize=16, leading=22, fontName="Helvetica-Bold",
        textColor=DARK_BLUE, spaceBefore=18, spaceAfter=8,
        borderPad=4
    )
    styles["h2"] = ParagraphStyle(
        "h2", fontSize=13, leading=18, fontName="Helvetica-Bold",
        textColor=MID_BLUE, spaceBefore=14, spaceAfter=6
    )
    styles["h3"] = ParagraphStyle(
        "h3", fontSize=11, leading=15, fontName="Helvetica-Bold",
        textColor=DARK_BLUE, spaceBefore=10, spaceAfter=4
    )
    styles["body"] = ParagraphStyle(
        "body", fontSize=10, leading=15, fontName="Helvetica",
        textColor=black, spaceAfter=6, alignment=TA_JUSTIFY
    )
    styles["body_left"] = ParagraphStyle(
        "body_left", fontSize=10, leading=15, fontName="Helvetica",
        textColor=black, spaceAfter=4, alignment=TA_LEFT
    )
    styles["bullet"] = ParagraphStyle(
        "bullet", fontSize=10, leading=14, fontName="Helvetica",
        textColor=black, spaceAfter=3, leftIndent=16,
        bulletIndent=4
    )
    styles["code_label"] = ParagraphStyle(
        "code_label", fontSize=9, leading=12, fontName="Helvetica-Bold",
        textColor=GREY, spaceBefore=6, spaceAfter=2
    )
    styles["code"] = ParagraphStyle(
        "code", fontSize=8, leading=11, fontName="Courier",
        textColor=CODE_FG, backColor=CODE_BG, spaceAfter=6,
        leftIndent=8, rightIndent=8, spaceBefore=4,
        borderPad=6
    )
    styles["caption"] = ParagraphStyle(
        "caption", fontSize=8, leading=11, fontName="Helvetica-Oblique",
        textColor=GREY, spaceAfter=8, alignment=TA_CENTER
    )
    styles["warn"] = ParagraphStyle(
        "warn", fontSize=10, leading=14, fontName="Helvetica",
        textColor=WARN, spaceAfter=4
    )
    styles["pass"] = ParagraphStyle(
        "pass", fontSize=10, leading=14, fontName="Helvetica",
        textColor=GREEN, spaceAfter=4
    )
    styles["toc_entry"] = ParagraphStyle(
        "toc_entry", fontSize=10, leading=16, fontName="Helvetica",
        textColor=DARK_BLUE, leftIndent=0, spaceAfter=2
    )
    styles["toc_sub"] = ParagraphStyle(
        "toc_sub", fontSize=9, leading=14, fontName="Helvetica",
        textColor=MID_BLUE, leftIndent=16, spaceAfter=1
    )
    return styles

S = build_styles()

def hr():
    return HRFlowable(width="100%", thickness=1, color=ACCENT, spaceAfter=8, spaceBefore=4)

def section_hr():
    return HRFlowable(width="100%", thickness=0.5, color=HexColor("#e0e0e0"), spaceAfter=6, spaceBefore=2)

def sp(h=6):
    return Spacer(1, h)

def h1(text):
    return Paragraph(text, S["h1"])

def h2(text):
    return Paragraph(text, S["h2"])

def h3(text):
    return Paragraph(text, S["h3"])

def body(text):
    return Paragraph(text, S["body"])

def body_left(text):
    return Paragraph(text, S["body_left"])

def bullet(text, symbol="•"):
    return Paragraph(f"{symbol}  {text}", S["bullet"])

def code_block(text, label=None):
    items = []
    if label:
        items.append(Paragraph(label, S["code_label"]))
    # Use Preformatted for monospace code blocks
    items.append(Preformatted(text, S["code"]))
    return items

def check_row(label, status, note=""):
    status_col = Paragraph(
        f'<font color="{"#2e7d32" if status else "#b71c1c"}">{"✔ PASS" if status else "✘ FAIL"}</font>',
        S["body_left"]
    )
    return [Paragraph(label, S["body_left"]), status_col, Paragraph(note, S["body_left"])]

def req_table(rows):
    col_w = [9*cm, 2.5*cm, 5.5*cm]
    data = [[
        Paragraph("<b>Requirement</b>", S["body_left"]),
        Paragraph("<b>Status</b>", S["body_left"]),
        Paragraph("<b>Notes</b>", S["body_left"]),
    ]] + rows
    t = Table(data, colWidths=col_w, repeatRows=1)
    t.setStyle(TableStyle([
        ("BACKGROUND",  (0,0), (-1,0), DARK_BLUE),
        ("TEXTCOLOR",   (0,0), (-1,0), white),
        ("FONTNAME",    (0,0), (-1,0), "Helvetica-Bold"),
        ("FONTSIZE",    (0,0), (-1,0), 9),
        ("ROWBACKGROUNDS", (0,1), (-1,-1), [white, LIGHT_BG]),
        ("GRID",        (0,0), (-1,-1), 0.4, HexColor("#bdbdbd")),
        ("VALIGN",      (0,0), (-1,-1), "TOP"),
        ("TOPPADDING",  (0,0), (-1,-1), 5),
        ("BOTTOMPADDING",(0,0), (-1,-1), 5),
        ("LEFTPADDING", (0,0), (-1,-1), 6),
        ("RIGHTPADDING",(0,0), (-1,-1), 6),
        ("FONTSIZE",    (0,1), (-1,-1), 9),
    ]))
    return t

def info_box(text, bg=PASS_GREEN, border=PASS_BORDER):
    data = [[Paragraph(text, S["body_left"])]]
    t = Table(data, colWidths=[PAGE_W - 2*MARGIN])
    t.setStyle(TableStyle([
        ("BACKGROUND",  (0,0), (-1,-1), bg),
        ("BOX",         (0,0), (-1,-1), 1.5, border),
        ("TOPPADDING",  (0,0), (-1,-1), 8),
        ("BOTTOMPADDING",(0,0), (-1,-1), 8),
        ("LEFTPADDING", (0,0), (-1,-1), 10),
        ("RIGHTPADDING",(0,0), (-1,-1), 10),
    ]))
    return t

def warning_box(text):
    return info_box(text, bg=WARN_BG, border=WARN_BORDER)


# ═══════════════════════════════════════════════════════════════════
# COVER PAGE
# ═══════════════════════════════════════════════════════════════════
def cover_page():
    items = []

    # Blue header banner (simulated via a table)
    cover_data = [[
        Paragraph("OTH Summer School — Blockchain", S["subtitle"]),
    ],[
        Paragraph("Voting Smart Contract", S["title"]),
    ],[
        Paragraph("Code Analysis &amp; Presentation Report", S["subtitle"]),
    ]]
    banner = Table(cover_data, colWidths=[PAGE_W - 2*MARGIN])
    banner.setStyle(TableStyle([
        ("BACKGROUND",   (0,0), (-1,-1), DARK_BLUE),
        ("TOPPADDING",   (0,0), (-1,-1), 12),
        ("BOTTOMPADDING",(0,0), (-1,-1), 12),
        ("LEFTPADDING",  (0,0), (-1,-1), 16),
        ("RIGHTPADDING", (0,0), (-1,-1), 16),
    ]))
    items.append(banner)
    items.append(sp(20))

    # Meta table
    meta = [
        ["Date", "August 2026"],
        ["Platform", "Hedera Testnet"],
        ["Language", "Solidity ^0.8.28"],
        ["Toolchain", "Hardhat 3 + Hedera JS SDK 2.62"],
        ["Contract", "contracts/Voting.sol"],
        ["Test Suite", "test/Voting.t.sol  (Foundry / forge-std)"],
    ]
    mt = Table(meta, colWidths=[4*cm, PAGE_W - 2*MARGIN - 4*cm])
    mt.setStyle(TableStyle([
        ("FONTNAME",  (0,0), (-1,-1), "Helvetica"),
        ("FONTNAME",  (0,0), (0,-1), "Helvetica-Bold"),
        ("FONTSIZE",  (0,0), (-1,-1), 10),
        ("TEXTCOLOR", (0,0), (0,-1), DARK_BLUE),
        ("ROWBACKGROUNDS", (0,0), (-1,-1), [white, LIGHT_BG]),
        ("GRID",      (0,0), (-1,-1), 0.4, HexColor("#bdbdbd")),
        ("TOPPADDING",(0,0), (-1,-1), 6),
        ("BOTTOMPADDING",(0,0), (-1,-1), 6),
        ("LEFTPADDING",(0,0), (-1,-1), 8),
    ]))
    items.append(mt)
    items.append(sp(20))
    items.append(body(
        "This report analyses the Voting smart contract against the project requirements stated in the "
        "course slides (last three pages of <i>All Lectures.pdf</i>). "
        "It documents every meaningful function and code decision, flags any lines that could "
        "attract questions during the live presentation, suggests one small clean-up, "
        "and concludes with the exact commands needed to compile, test, and run the demo."
    ))
    items.append(PageBreak())
    return items


# ═══════════════════════════════════════════════════════════════════
# SECTION 1 – Requirements Checklist
# ═══════════════════════════════════════════════════════════════════
def section_requirements():
    items = [h1("1.  Requirements Checklist")]
    items.append(body(
        "The project requirements come from slides 379–381 of <i>All Lectures.pdf</i>. "
        "Each bullet point is mapped to the corresponding implementation below."
    ))
    items.append(sp(6))

    rows = [
        check_row("Create a Smart Contract",                True,  "contracts/Voting.sol – 310 lines of Solidity"),
        check_row("Deploy to a ledger",                     True,  "deploy-voting.js / demo.js → Hedera Testnet via Hedera JS SDK"),
        check_row("Call functions with multiple accounts",  True,  "demo.js uses operator, admin, voter1, voter2, voter3"),
        check_row("Topics defined by the constructor",      True,  "constructor(topicA, topicB, topicC, initialAdmin)"),
        check_row("Everybody can vote exactly once",        True,  "hasVoted mapping + AlreadyVoted error"),
        check_row("Results of voting can be printed",       True,  "getResults() returns human-readable string"),
        check_row("Contract must be secure",                True,  "custom errors, msg.sender guards, no tx.origin, reentrancy-safe pattern"),
        check_row("Blocklist (accounts not allowed to vote)",True, "blocked mapping + admin-only setBlocked / blockVoter / unblockVoter"),
    ]
    items.append(req_table(rows))
    items.append(sp(8))
    items.append(info_box(
        "<b>Result: all 8 requirements are fully satisfied.</b>  "
        "The contract goes beyond the minimum by adding an auditable, enumerable blocklist, "
        "a separated owner/admin role, and a comprehensive 34-test suite."
    ))
    items.append(PageBreak())
    return items


# ═══════════════════════════════════════════════════════════════════
# SECTION 2 – Suggested Changes
# ═══════════════════════════════════════════════════════════════════
def section_changes():
    items = [h1("2.  Suggested Changes Before the Presentation")]
    items.append(body(
        "The code is clean and correct.  There is <b>one cosmetic change</b> worth making to "
        "avoid a distraction during the demo: the default topics in <code>deploy-voting.js</code> "
        "contain a typo that would look odd if a professor reads it aloud."
    ))
    items.append(sp(6))

    items.append(h2("2.1  Fix the Default Topics Typo  (deploy-voting.js line 36)"))
    items.append(body(
        "The array <code>DEFAULT_TOPICS</code> currently reads:"
    ))
    items += code_block('const DEFAULT_TOPICS = ["Masala Dosai", "Briyani", "SushPani Puri"];',
                        label="Current (deploy-voting.js : line 36)")
    items.append(body(
        '<b>"SushPani Puri"</b> is clearly a merge of two food names — "Sushi" and "Pani Puri". '
        'This is never used in the live demo (demo.js hardcodes <code>["Pizza","Pasta","Sushi"]</code>), '
        'but it will be visible if someone runs <code>node deploy-voting.js</code> without flags. '
        'Suggested fix — choose three consistent topics:'
    ))
    items += code_block('const DEFAULT_TOPICS = ["Pizza", "Pasta", "Sushi"];',
                        label="Suggested fix")
    items.append(sp(4))
    items.append(warning_box(
        "<b>Why this matters for the presentation:</b>  if a professor or classmate runs "
        "<code>node deploy-voting.js</code> during the demo, the console will print "
        '<i>\'SushPani Puri\'</i> which could invite questions unrelated to the blockchain logic.'
    ))
    items.append(sp(10))

    items.append(h2("2.2  Remove Unused npm Scripts  (package.json lines 17–18)"))
    items.append(body(
        "The <code>package.json</code> references two scripts — <code>deploy</code> and "
        "<code>call</code> — that map to <code>deploy.js</code> and <code>call.js</code>. "
        "Neither of those files exists in the repository. Running them produces an error."
    ))
    items += code_block(
        '"deploy": "node deploy.js",\n"call":   "node call.js"',
        label="Lines to remove from package.json"
    )
    items.append(body(
        "Simply delete those two entries.  All other scripts "
        "(<code>compile</code>, <code>test</code>, <code>demo</code>, etc.) work correctly."
    ))
    items.append(sp(8))

    items.append(h2("2.3  No Changes Needed in Voting.sol or the Test Suite"))
    items.append(info_box(
        "The smart contract and all 34 unit tests are correct and presentation-ready as-is. "
        "No logic, security, or style changes are recommended."
    ))
    items.append(PageBreak())
    return items


# ═══════════════════════════════════════════════════════════════════
# SECTION 3 – Code Walkthrough
# ═══════════════════════════════════════════════════════════════════
def section_walkthrough():
    items = [h1("3.  Code Walkthrough — Functions &amp; Key Lines")]
    items.append(body(
        "Below every function and significant code block is explained. "
        "Lines marked <b>[Q]</b> are the ones most likely to attract a question during the presentation."
    ))

    # 3.1 Contract header
    items.append(h2("3.1  Voting.sol — Contract Header &amp; State Variables"))
    items.append(sp(4))

    rows_state = [
        ["<b>Line(s)</b>", "<b>Element</b>", "<b>Explanation</b>"],
        ["1–2",  "SPDX + pragma",
         "Declares the open-source MIT licence and requires Solidity compiler ≥ 0.8.28. "
         "The compiler enforces arithmetic overflow checks by default from 0.8.0 onwards."],
        ["56",   "TOPIC_COUNT = 3",
         "A compile-time constant that acts as the fixed array size everywhere. "
         "Using a named constant makes the '3' self-documenting and prevents accidental mismatches."],
        ["59",   "address public immutable owner",
         "<b>[Q]</b> <i>immutable</i> means the value is written once in the constructor and baked "
         "into the contract bytecode. It cannot be changed after deployment — not even by the owner. "
         "Cheaper to read than a regular storage slot."],
        ["62",   "address public admin",
         "Mutable; can be handed over with setAdmin(). Separated from owner so the power to exclude "
         "voters sits in exactly one place and can be transferred without redeploying."],
        ["65",   "string[TOPIC_COUNT] private _topics",
         "Fixed-size array of three strings. Private means it cannot be read directly from outside "
         "the contract; getTopic() is the public accessor."],
        ["68",   "uint256[TOPIC_COUNT] private _tally",
         "One counter per topic. Incremented inside an unchecked block (see vote())."],
        ["71",   "mapping(address => bool) public hasVoted",
         "<b>[Q]</b> A mapping from wallet address to boolean. Public auto-generates a getter. "
         "Set to true the moment a vote is cast — this is the 'exactly once' enforcement."],
        ["74",   "mapping(address => bool) public blocked",
         "O(1) lookup: is this address on the blocklist? Public so anyone can audit it."],
        ["77",   "address[] private _blockedList",
         "Parallel array that lets anyone enumerate all blocked accounts. "
         "Required because a mapping alone is not iterable on-chain."],
        ["80",   "mapping(address => uint256) private _blockedSlot",
         "Stores the 1-based index of each address in _blockedList. Enables O(1) removal "
         "via the swap-and-pop pattern. 0 means 'not in the list'."],
        ["83",   "uint256 public totalVotes",
         "Running total across all topics. Useful for a quick sanity check without summing the tally array."],
    ]
    col_w2 = [1.5*cm, 4*cm, 11.5*cm]
    t2 = Table(
        [[Paragraph(c, S["body_left"]) for c in r] for r in rows_state],
        colWidths=col_w2, repeatRows=1
    )
    t2.setStyle(TableStyle([
        ("BACKGROUND",  (0,0), (-1,0), DARK_BLUE),
        ("TEXTCOLOR",   (0,0), (-1,0), white),
        ("FONTNAME",    (0,0), (-1,0), "Helvetica-Bold"),
        ("FONTSIZE",    (0,0), (-1,-1), 8),
        ("ROWBACKGROUNDS",(0,1),(-1,-1),[white, LIGHT_BG]),
        ("GRID",        (0,0), (-1,-1), 0.3, HexColor("#bdbdbd")),
        ("VALIGN",      (0,0), (-1,-1), "TOP"),
        ("TOPPADDING",  (0,0), (-1,-1), 5),
        ("BOTTOMPADDING",(0,0), (-1,-1), 5),
        ("LEFTPADDING", (0,0), (-1,-1), 5),
        ("RIGHTPADDING",(0,0), (-1,-1), 5),
    ]))
    items.append(t2)
    items.append(sp(10))

    # 3.2 Constructor
    items.append(h2("3.2  constructor()  —  Lines 89–114"))
    items += code_block(
        "constructor(\n"
        "    string memory topicA,\n"
        "    string memory topicB,\n"
        "    string memory topicC,\n"
        "    address initialAdmin\n"
        ") {\n"
        "    if (bytes(topicA).length == 0 || ...) revert EmptyTopic();\n"
        "    if (initialAdmin == address(0))      revert ZeroAddress();\n"
        "    owner = msg.sender;\n"
        "    admin = initialAdmin;\n"
        "    _topics[0..2] = topicA, topicB, topicC;\n"
        "    emit AdminChanged(address(0), initialAdmin);\n"
        "}"
    )
    items.append(body(
        "<b>[Q]</b>  <b>Why bytes(topicA).length?</b>  In Solidity, you cannot compare a "
        "<code>string</code> directly to <code>\"\"</code>. Casting to <code>bytes</code> exposes the "
        "length. An empty string would mean a ballot option with no label — a permanent deployment mistake "
        "since the topics can never change after construction.<br/><br/>"
        "<b>[Q]</b>  <b>Why is initialAdmin required to be non-zero?</b>  "
        "address(0) is the burn/null address; no private key controls it, so a zero admin would "
        "lock the blocklist permanently with no way to add or remove entries."
    ))
    items.append(sp(6))

    # 3.3 Modifiers
    items.append(h2("3.3  Modifiers  —  Lines 123–131"))
    items += code_block(
        "modifier onlyOwner() {\n"
        "    if (msg.sender != owner) revert NotOwner();\n"
        "    _;\n"
        "}\n\n"
        "modifier onlyAdmin() {\n"
        "    if (msg.sender != admin) revert NotAdmin();\n"
        "    _;\n"
        "}"
    )
    items.append(body(
        "<b>[Q]</b>  <b>Why msg.sender and not tx.origin?</b>  "
        "<code>tx.origin</code> is the original wallet that started a transaction chain. "
        "If the owner ever calls into a malicious contract that then calls <code>setAdmin()</code>, "
        "<code>tx.origin</code> would still be the owner and the attack would succeed. "
        "<code>msg.sender</code> is the <i>immediate</i> caller, so this attack is impossible."
    ))
    items.append(sp(6))

    # 3.4 vote()
    items.append(h2("3.4  vote()  —  Lines 141–158"))
    items += code_block(
        "function vote(uint256 topicIndex) external {\n"
        "    if (topicIndex >= TOPIC_COUNT) revert InvalidTopic(topicIndex);\n"
        "    if (blocked[msg.sender])       revert AccountBlocked();\n"
        "    if (hasVoted[msg.sender])      revert AlreadyVoted();\n\n"
        "    hasVoted[msg.sender] = true;    // Effects first\n"
        "    unchecked {\n"
        "        _tally[topicIndex] += 1;\n"
        "        totalVotes += 1;\n"
        "    }\n"
        "    emit VoteCast(msg.sender, topicIndex);\n"
        "}"
    )
    items.append(body(
        "<b>[Q]</b>  <b>Check order — why blocked before hasVoted?</b>  "
        "A blocked address gets a clearer error message (<i>AccountBlocked</i>) rather than "
        "<i>AlreadyVoted</i>, which would be confusing if the address had voted before being blocked.<br/><br/>"
        "<b>[Q]</b>  <b>Why unchecked?</b>  The number of distinct Ethereum/Hedera addresses "
        "(2^160) is far larger than uint256 max (2^256 - 1), so these counters can never physically "
        "overflow. The <code>unchecked</code> block saves a small amount of gas by skipping Solidity's "
        "built-in overflow guard.<br/><br/>"
        "<b>[Q]</b>  <b>Effects before interactions (CEI pattern)?</b>  "
        "<code>hasVoted</code> is set <i>before</i> the event is emitted. There are no external calls, "
        "so re-entrancy is not reachable here, but the pattern is maintained as a best practice in case "
        "the contract is ever extended."
    ))
    items.append(sp(6))

    # 3.5 setBlocked
    items.append(h2("3.5  setBlocked()  —  Lines 168–199"))
    items += code_block(
        "function setBlocked(address account, bool isBlocked) public onlyAdmin {\n"
        "    if (account == address(0)) revert ZeroAddress();\n"
        "    if (account == owner)      revert OwnerCannotBeBlocked();\n"
        "    if (account == admin)      revert AdminCannotBeBlocked();\n"
        "    if (blocked[account] == isBlocked) return;  // idempotent\n\n"
        "    blocked[account] = isBlocked;\n"
        "    if (isBlocked) {\n"
        "        _blockedList.push(account);\n"
        "        _blockedSlot[account] = _blockedList.length; // 1-based\n"
        "    } else {\n"
        "        // Swap-and-pop: O(1) removal\n"
        "        uint256 slot = _blockedSlot[account];\n"
        "        address moved = _blockedList[_blockedList.length - 1];\n"
        "        _blockedList[slot - 1] = moved;\n"
        "        _blockedSlot[moved] = slot;\n"
        "        _blockedList.pop();\n"
        "        _blockedSlot[account] = 0;\n"
        "    }\n"
        "    emit AccountBlockedSet(account, isBlocked);\n"
        "}"
    )
    items.append(body(
        "<b>[Q]</b>  <b>Why can't the admin block the owner or itself?</b>  "
        "Blocking the owner would let a rogue admin lock out the deployer. Blocking itself would leave "
        "the list unmanageable (the admin could never unblock anyone either).<br/><br/>"
        "<b>[Q]</b>  <b>Idempotent early return?</b>  "
        "If you try to block an already-blocked address, the function returns early without modifying "
        "storage or emitting an event. This prevents duplicate entries in _blockedList and saves gas.<br/><br/>"
        "<b>[Q]</b>  <b>Swap-and-pop?</b>  "
        "Removing an element from the middle of an array by shifting all elements right costs O(n) gas. "
        "Swap-and-pop swaps the target element with the last element and removes the last element — "
        "always O(1). Order in the list is not meaningful (it is just an audit trail), so this is safe.<br/><br/>"
        "<b>[Q]</b>  <b>Why _blockedSlot stores index+1?</b>  "
        "A mapping returns 0 for any key that was never set. Storing 1-based indices means 0 unambiguously "
        "means 'not in the list', preventing a bug where slot 0 could be confused with an absent entry."
    ))
    items.append(sp(6))

    # 3.6 Convenience wrappers
    items.append(h2("3.6  blockVoter() / unblockVoter()  —  Lines 202–209"))
    items += code_block(
        "function blockVoter(address account)   external { setBlocked(account, true);  }\n"
        "function unblockVoter(address account) external { setBlocked(account, false); }"
    )
    items.append(body(
        "Thin wrappers that let callers use a readable function name instead of passing a boolean "
        "flag. They inherit the <code>onlyAdmin</code> guard through the delegation to "
        "<code>setBlocked()</code>."
    ))
    items.append(sp(6))

    # 3.7 setAdmin
    items.append(h2("3.7  setAdmin()  —  Lines 212–216"))
    items += code_block(
        "function setAdmin(address newAdmin) external onlyOwner {\n"
        "    if (newAdmin == address(0)) revert ZeroAddress();\n"
        "    emit AdminChanged(admin, newAdmin);\n"
        "    admin = newAdmin;\n"
        "}"
    )
    items.append(body(
        "<b>[Q]</b>  <b>Why emit before assignment?</b>  "
        "The event captures the <i>previous</i> admin address. Emitting first makes the log contain "
        "the old value; assigning first would lose it. "
        "There is no external call here, so re-entrancy is not a concern."
    ))
    items.append(sp(6))

    # 3.8 Blocklist readers
    items.append(h2("3.8  Blocklist Readers  —  Lines 223–242"))
    items += code_block(
        "getBlockedCount() → uint256          // number of blocked addresses\n"
        "getBlockedVoter(uint256 index) → address  // address at position i\n"
        "getBlockedVoters() → address[] memory     // whole list in one call"
    )
    items.append(body(
        "Three read-only views. <code>getBlockedVoters()</code> returns an unbounded array which "
        "is fine because only the admin can grow the list. The scripts prefer the "
        "<code>getBlockedCount</code> + <code>getBlockedVoter(i)</code> pair because the Hedera "
        "SDK cannot decode a dynamic <code>address[]</code> return value conveniently."
    ))
    items.append(sp(6))

    # 3.9 getResults
    items.append(h2("3.9  getResults()  —  Lines 253–260"))
    items += code_block(
        'function getResults() external view returns (string memory) {\n'
        '    return string.concat(\n'
        '        _topics[0], ": ", _toString(_tally[0]), " | ",\n'
        '        _topics[1], ": ", _toString(_tally[1]), " | ",\n'
        '        _topics[2], ": ", _toString(_tally[2])\n'
        '    );\n'
        '}\n'
        '// Example output: "Pizza: 2 | Pasta: 1 | Sushi: 0"'
    )
    items.append(body(
        "<b>[Q]</b>  <b>Why a single string instead of an array?</b>  "
        "The Hedera JS SDK's <code>ContractCallQuery</code> can decode a single <code>string</code> "
        "return with <code>getString(0)</code>. Decoding a <code>string[]</code> would require "
        "custom ABI parsing. Returning one formatted string keeps the off-chain code simpler."
    ))
    items.append(sp(6))

    # 3.10 getVotes / getTopic / canVote / whoAmI
    items.append(h2("3.10  Utility Views  —  Lines 263–286"))
    items += code_block(
        "getTopic(uint256 topicIndex) → string    // label of topic 0, 1 or 2\n"
        "getVotes(uint256 topicIndex) → uint256   // vote count for a topic\n"
        "canVote(address account)    → bool       // !blocked && !hasVoted\n"
        "whoAmI()                    → address    // returns msg.sender"
    )
    items.append(body(
        "<b>[Q]</b>  <b>What is whoAmI() for?</b>  "
        "Hedera maps every native account (0.0.xxxx) to an EVM address. This helper lets you "
        "call the contract and see exactly which EVM address the network associates with your key, "
        "so you know which address to pass to <code>blockVoter()</code>."
    ))
    items.append(sp(6))

    # 3.11 _toString
    items.append(h2("3.11  _toString()  —  Lines 293–308  (internal helper)"))
    items += code_block(
        "function _toString(uint256 value) private pure returns (string memory) {\n"
        "    if (value == 0) return \"0\";\n"
        "    // Count digits\n"
        "    uint256 digits;\n"
        "    for (uint256 temp = value; temp != 0; temp /= 10) digits++;\n"
        "    // Fill buffer right-to-left\n"
        "    bytes memory buffer = new bytes(digits);\n"
        "    while (value != 0) {\n"
        "        digits--;\n"
        "        buffer[digits] = bytes1(uint8(48 + (value % 10)));\n"
        "        value /= 10;\n"
        "    }\n"
        "    return string(buffer);\n"
        "}"
    )
    items.append(body(
        "<b>[Q]</b>  <b>Why not use OpenZeppelin's Strings library?</b>  "
        "This avoids an external dependency. The logic is only 15 lines, and for a course project "
        "it is clearer to show the implementation explicitly. The algorithm is standard: "
        "count digits in the first loop, then fill a byte buffer right-to-left using ASCII offset 48 "
        "(the character '0').<br/><br/>"
        "<b>48 + value % 10</b> — 48 is the ASCII code of '0'. Adding the digit (0–9) gives '0'–'9'."
    ))

    items.append(PageBreak())
    return items


# ═══════════════════════════════════════════════════════════════════
# SECTION 4 – Off-chain Scripts
# ═══════════════════════════════════════════════════════════════════
def section_scripts():
    items = [h1("4.  Off-chain Scripts Explained")]

    scripts = [
        ("create-accounts.js",
         "Creates VOTER1…VOTER3 (and ADMIN) Hedera Testnet accounts and writes their IDs and "
         "ECDSA private keys into <code>.env</code>. ECDSA keys are required because only ECDSA "
         "accounts have a derived EVM address that becomes <code>msg.sender</code> on-chain. "
         "ED25519 accounts would resolve to Hedera's 'long-zero' address form, which the contract "
         "cannot distinguish per voter."),
        ("deploy-voting.js",
         "Compiles the contract artifact (already compiled by Hardhat), reads it, and deploys via "
         "<code>ContractCreateFlow</code>. Constructor arguments (three topic strings + admin address) "
         "are encoded with <code>ContractFunctionParameters</code>. After deployment the contract ID "
         "is written back into <code>.env</code> so other scripts pick it up automatically."),
        ("demo.js",
         "End-to-end live demo: deploys a fresh contract, runs the 8-step story (block voter3, "
         "three successful votes, three rejections, print blocklist and tally). Uses five separate "
         "clients (one per account) so each transaction is signed by the correct key. Prints "
         "checkmarks (✅) and crosses (❌) for each step."),
        ("vote.js",
         "Cast a single vote from a named account.  First calls <code>canVote()</code> and "
         "<code>getTopic()</code> to print a pre-flight status, then sends the <code>vote()</code> "
         "transaction. On rejection it decodes the custom error name from the 4-byte selector and "
         "prints it (e.g. <i>AlreadyVoted()</i>)."),
        ("block.js",
         "Admin-only: block or unblock an account. Accepts a label (<i>voter3</i>) or raw 0x "
         "address. Calls <code>setBlocked(address, bool)</code>. Demonstrates the NotAdmin error "
         "when a non-admin account sends the transaction."),
        ("status.js",
         "Read-only dashboard: calls <code>owner</code>, <code>admin</code>, <code>getResults()</code>, "
         "<code>getTopic/getVotes</code> (per topic), <code>getBlockedCount/getBlockedVoter</code>, "
         "and <code>hasVoted/blocked/canVote</code> (per account). No state is changed. "
         "Safe to run as many times as needed during the demo."),
        ("lib/hedera.js",
         "Shared utilities: <code>parsePrivateKey()</code> — handles both raw 64-hex ECDSA keys and "
         "DER-encoded keys without silently returning the wrong key type; <code>loadAccount()</code> — "
         "reads ID+KEY from .env; <code>loadVoters()</code> — iterates VOTER1…VOTERn; "
         "<code>makeClient()</code> — Testnet client with a 20 HBAR max fee cap; "
         "<code>loadErrorSelectors()</code> — builds a 4-byte-selector→name map from the ABI so "
         "reverts are reported by name; <code>fetchRevertReason()</code> — re-queries the record "
         "with receipt validation off to extract the revert data; <code>updateEnvFile()</code> — "
         "idempotently writes key=value pairs into .env."),
    ]

    for name, desc in scripts:
        items.append(h2(f"  {name}"))
        items.append(body(desc))
        items.append(sp(4))

    items.append(PageBreak())
    return items


# ═══════════════════════════════════════════════════════════════════
# SECTION 5 – Commands
# ═══════════════════════════════════════════════════════════════════
def section_commands():
    items = [h1("5.  Commands to Run the Code")]

    # Prerequisites
    items.append(h2("5.1  Prerequisites"))
    rows_pre = [
        ["Node.js ≥ 18",  "node --version"],
        ["npm packages",  "npm install"],
        [".env file",     "Copy .env.example to .env and fill in HEDERA_OPERATOR_ID and HEDERA_OPERATOR_KEY"],
        ["Hedera account","Free Testnet account at https://portal.hedera.com/"],
    ]
    t = Table(rows_pre, colWidths=[4.5*cm, PAGE_W - 2*MARGIN - 4.5*cm])
    t.setStyle(TableStyle([
        ("FONTNAME",   (0,0), (-1,-1), "Helvetica"),
        ("FONTNAME",   (0,0), (0,-1),  "Helvetica-Bold"),
        ("FONTSIZE",   (0,0), (-1,-1), 9),
        ("TEXTCOLOR",  (0,0), (0,-1),  DARK_BLUE),
        ("ROWBACKGROUNDS",(0,0),(-1,-1),[white, LIGHT_BG]),
        ("GRID",       (0,0), (-1,-1), 0.3, HexColor("#bdbdbd")),
        ("TOPPADDING", (0,0), (-1,-1), 5),
        ("BOTTOMPADDING",(0,0),(-1,-1),5),
        ("LEFTPADDING",(0,0), (-1,-1), 6),
    ]))
    items.append(t)
    items.append(sp(10))

    # Step-by-step
    items.append(h2("5.2  Step-by-step Workflow"))

    steps = [
        ("Step 1 — Install dependencies",
         "npm install",
         "Downloads @hashgraph/sdk, dotenv, js-sha3, hardhat, forge-std into node_modules."),
        ("Step 2 — Compile the contract",
         "npm run compile\n# or: npx hardhat compile",
         "Hardhat compiles contracts/Voting.sol and writes the ABI + bytecode to\n"
         "artifacts/contracts/Voting.sol/Voting.json.  Required before any deploy step."),
        ("Step 3 — Run the unit tests",
         "npm test\n# or: npx hardhat test solidity",
         "Runs all 34 Foundry/forge-std tests inside Hardhat's in-process EVM.\n"
         "All tests should pass in < 2 seconds.  No Hedera account or HBAR needed."),
        ("Step 4 — Create accounts",
         "node create-accounts.js\n# Creates VOTER1, VOTER2, VOTER3  (20 HBAR each)\n\n"
         "node create-accounts.js --prefix ADMIN --count 1\n# Creates ADMIN  (20 HBAR)",
         "Creates ECDSA accounts on Hedera Testnet funded from the operator.\n"
         "Writes VOTER1_ID, VOTER1_KEY, … and ADMIN_ID, ADMIN_KEY into .env."),
        ("Step 5a — Full automated demo  (recommended for presentation)",
         "node demo.js",
         "Deploys a fresh contract and runs all 8 steps automatically.\n"
         "Prints ✅ / ❌ for every action.  Topics are Pizza, Pasta, Sushi."),
        ("Step 5b — Manual deployment",
         "node deploy-voting.js\n# or with custom topics:\n"
         "node deploy-voting.js --topics \"Tea,Coffee,Water\"\n# or with a different admin:\n"
         "node deploy-voting.js --admin voter1",
         "Deploys the contract and saves CONTRACT_ID to .env."),
        ("Step 6 — Check current state",
         "node status.js",
         "Read-only: prints owner, admin, tally per topic, blocklist, and per-account flags.\n"
         "Run this between other commands to verify state changes."),
        ("Step 7 — Cast a vote",
         "node vote.js --as voter1 --topic 0\nnode vote.js --as voter2 --topic 1\n"
         "node vote.js --as voter3 --topic 0    # will fail if voter3 is blocked",
         "--as: account label (operator, voter1, voter2, voter3)\n"
         "--topic: 0, 1 or 2"),
        ("Step 8 — Block / unblock a voter",
         "node block.js --account voter3           # sent by admin (default)\n"
         "node block.js --account voter3 --unblock\n"
         "node block.js --account voter1 --as voter2   # demonstrates NotAdmin error\n"
         "node block.js --account voter1 --as operator # owner is not the admin",
         "Sent by the admin by default.  Use --as to demonstrate rejection."),
    ]

    for title, cmd, desc in steps:
        items.append(h3(f"  {title}"))
        items += code_block(cmd)
        items.append(body(desc))
        items.append(sp(4))

    items.append(PageBreak())

    # Quick reference
    items.append(h2("5.3  Quick Reference Card"))
    qr = [
        ["Command", "Purpose"],
        ["npm install",                        "Install all dependencies"],
        ["npm run compile",                    "Compile Voting.sol → artifact JSON"],
        ["npm test",                           "Run 34 unit tests (no Hedera needed)"],
        ["node create-accounts.js",            "Create voter1/2/3 accounts on Testnet"],
        ["node create-accounts.js --prefix ADMIN --count 1", "Create admin account"],
        ["node demo.js",                       "Full end-to-end automated demo"],
        ["node deploy-voting.js",              "Deploy contract, save CONTRACT_ID to .env"],
        ["node status.js",                     "Print current contract state"],
        ["node vote.js --as voter1 --topic 0", "voter1 votes for topic 0 (Pizza)"],
        ["node block.js --account voter3",     "Admin blocks voter3"],
        ["node block.js --account voter3 --unblock", "Admin unblocks voter3"],
    ]
    qt = Table(
        [[Paragraph(c, S["body_left"]) for c in r] for r in qr],
        colWidths=[9*cm, 8*cm], repeatRows=1
    )
    qt.setStyle(TableStyle([
        ("BACKGROUND",  (0,0), (-1,0), MID_BLUE),
        ("TEXTCOLOR",   (0,0), (-1,0), white),
        ("FONTNAME",    (0,0), (-1,0), "Helvetica-Bold"),
        ("FONTSIZE",    (0,0), (-1,-1), 8),
        ("ROWBACKGROUNDS",(0,1),(-1,-1),[white, LIGHT_BG]),
        ("GRID",        (0,0), (-1,-1), 0.3, HexColor("#bdbdbd")),
        ("VALIGN",      (0,0), (-1,-1), "TOP"),
        ("TOPPADDING",  (0,0), (-1,-1), 5),
        ("BOTTOMPADDING",(0,0), (-1,-1),5),
        ("LEFTPADDING", (0,0), (-1,-1), 5),
    ]))
    items.append(qt)
    items.append(sp(10))

    # Demo order
    items.append(h2("5.4  Recommended Live Demo Order"))
    demo_steps = [
        "npm run compile  — show the Solidity file compiles cleanly",
        "npm test         — all 34 tests pass instantly",
        "node status.js   — show the initial state (empty tally, no blocklist)",
        "node demo.js     — run the full story with ✅/❌ output",
        "node status.js   — show the final state (Pizza:2, Pasta:1, voter3 blocked)",
    ]
    for i, s in enumerate(demo_steps, 1):
        items.append(bullet(f"<b>{i}.</b>  <code>{s}</code>"))

    return items


# ═══════════════════════════════════════════════════════════════════
# ASSEMBLE
# ═══════════════════════════════════════════════════════════════════
def build():
    doc = SimpleDocTemplate(
        OUTPUT_PATH,
        pagesize=A4,
        leftMargin=MARGIN, rightMargin=MARGIN,
        topMargin=2*cm, bottomMargin=2*cm,
        title="Voting Smart Contract Analysis Report",
        author="OTH Summer School",
        subject="Blockchain Project",
    )

    story = []
    story += cover_page()
    story += section_requirements()
    story += section_changes()
    story += section_walkthrough()
    story += section_scripts()
    story += section_commands()

    doc.build(story)
    print(f"PDF written to: {OUTPUT_PATH}")

if __name__ == "__main__":
    build()
