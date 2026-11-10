# -*- coding: utf-8 -*-
"""Generate el/index.html from index.html.

index.html is the source of truth and is English. This bakes the Greek
dictionary into a second real page so Google can index it: runtime
translation is invisible to a crawler, which is why the Greek half of this
site could not be found by anyone searching in Greek.

Run this after ANY edit to index.html, then deploy:

    python build.py && firebase deploy --only hosting
"""
import io, os, re, sys

SITE = u"https://personalportfolio-aa146.web.app"   # keep in step with index.html
ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, "index.html")
OUT_DIR = os.path.join(ROOT, "el")
OUT = os.path.join(OUT_DIR, "index.html")

src = io.open(SRC, encoding="utf-8").read()

# ---------------------------------------------------------------- dictionary
js = src[src.index("<script>"):]
_a = js.index("    el: {")
el_block = js[_a:js.index("\n    }", _a)]
EL = dict(re.findall(r'"([a-zA-Z0-9._]+)":"((?:[^"\\]|\\.)*)"', el_block))
if not EL:
    sys.exit("FAIL: could not read the Greek dictionary")


def unescape(v):
    return v.replace('\\"', '"').replace("\\'", "'").replace("\\n", "\n")


def inner_span(html, open_end, tag):
    """Index where this element's own closing tag starts, counting nesting.
       A naive non-greedy match stops at the first inner </em> and silently
       leaves the original tail behind, which has bitten this file before."""
    depth, i = 1, open_end
    op, cl = "<" + tag, "</" + tag
    while i < len(html):
        no, nc = html.find(op, i), html.find(cl, i)
        if nc == -1:
            return -1
        if no != -1 and no < nc:
            depth += 1
            i = no + len(op)
        else:
            depth -= 1
            if depth == 0:
                return nc
            i = nc + len(cl)
    return -1


out = src
swapped = missing = 0

# text and html-bearing nodes
for m in reversed(list(re.finditer(
        r'<(\w+)([^>]*?)data-i18n(-html)?="([\w.]+)"([^>]*)>', out))):
    tag, key = m.group(1), m.group(4)
    if key not in EL:
        missing += 1
        continue
    start = m.end()
    end = inner_span(out, start, tag)
    if end == -1:
        continue
    out = out[:start] + unescape(EL[key]) + out[end:]
    swapped += 1

# placeholders
for m in reversed(list(re.finditer(r'data-i18n-ph="([\w.]+)"', out))):
    key = m.group(1)
    if key not in EL:
        continue
    tag_start = out.rindex("<", 0, m.start())
    tag_end = out.index(">", m.end())
    tag_html = out[tag_start:tag_end]
    new_tag = re.sub(r'placeholder="[^"]*"',
                     'placeholder="%s"' % unescape(EL[key]).replace('"', "&quot;"),
                     tag_html)
    if new_tag != tag_html:
        out = out[:tag_start] + new_tag + out[tag_end:]
        swapped += 1

# ---------------------------------------------------------------- head swaps
def sub1(pattern, repl, label):
    global out
    new, n = re.subn(pattern, repl, out, count=1)
    if n != 1:
        sys.exit("FAIL %s" % label)
    out = new


sub1(r'<html lang="en">', '<html lang="el">', "html lang")
sub1(r'<title>[^<]*</title>',
     u'<title>Κατασκευή ιστοσελίδων στην Αθήνα από 449€ · Αντόνιο Μάτο</title>',
     "title")

EL_DESC = (u"Επαγγελματικοί ιστότοποι για επιχειρήσεις στην Αθήνα, σχεδιασμένοι και φτιαγμένοι στο χέρι. "
           u"Τρία πακέτα από 449€, με τον πρώτο χρόνο φιλοξενίας δωρεάν.")
EL_TITLE = (u"Κατασκευή ιστοσελίδων στην Αθήνα από 449€ · Αντόνιο Μάτο")

sub1(r'<meta name="description" content="[^"]*" />',
     '<meta name="description" content="%s" />' % EL_DESC, "meta description")
sub1(r'<link rel="canonical" href="[^"]*" />',
     '<link rel="canonical" href="%s/el/" />' % SITE, "canonical")
sub1(r'<meta property="og:url" content="[^"]*" />',
     '<meta property="og:url" content="%s/el/" />' % SITE, "og:url")
sub1(r'<meta property="og:title" content="[^"]*" />',
     '<meta property="og:title" content="%s" />' % EL_TITLE, "og:title")
sub1(r'<meta property="og:description" content="[^"]*" />',
     '<meta property="og:description" content="%s" />' % EL_DESC, "og:description")
sub1(r'<meta property="og:locale" content="en" />',
     '<meta property="og:locale" content="el" />', "og:locale")
sub1(r'<meta property="og:locale:alternate" content="el" />',
     '<meta property="og:locale:alternate" content="en" />', "og:locale:alternate")
sub1(r'<meta name="twitter:title" content="[^"]*" />',
     '<meta name="twitter:title" content="%s" />' % EL_TITLE, "twitter:title")
sub1(r'<meta name="twitter:description" content="[^"]*" />',
     '<meta name="twitter:description" content="%s" />' % EL_DESC, "twitter:description")

# the flag that is lit swaps over
sub1(r'<a href="/" class="active" aria-current="page" hreflang="en"',
     '<a href="/" hreflang="en"', "unlight EN flag")
sub1(r'<a href="/el/" hreflang="el"',
     '<a href="/el/" class="active" aria-current="page" hreflang="el"', "light EL flag")

if not os.path.isdir(OUT_DIR):
    os.makedirs(OUT_DIR)
io.open(OUT, "w", encoding="utf-8", newline="").write(out)

print("built el/index.html")
print("  %d strings translated, %d keys missing from the Greek dictionary" % (swapped, missing))
if missing:
    print("  WARNING: missing keys fall back to English on the Greek page")
