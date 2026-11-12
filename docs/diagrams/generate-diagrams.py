"""Generate ServeQ's editable workflow and architecture diagrams."""

from html import escape
from pathlib import Path

ROOT = Path(__file__).resolve().parent
INK = "#17372A"
SECONDARY = "#52665B"
GREEN = "#047857"
FOREST = "#114227"
BORDER = "#C9DAD0"
LINE = "#6C8576"
PALE = "#F7FCF9"
MINT = "#ECFDF5"
AMBER = "#986117"


class Diagram:
    def __init__(self, width, height, title, description):
        self.w, self.h = width, height
        self.parts = [
            f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}" role="img" aria-labelledby="title desc">',
            f'<title id="title">{escape(title)}</title>',
            f'<desc id="desc">{escape(description)}</desc>',
            '<defs>' + ''.join(f'<marker id="arrow-{color[1:]}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M1 1 L9 5 L1 9" fill="none" stroke="{color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></marker>' for color in (LINE, GREEN, AMBER)) + '</defs>',
            f'<rect width="{width}" height="{height}" fill="#FFFFFF"/>',
            '<g font-family="Arial, Helvetica, sans-serif">',
        ]

    def rect(self, x, y, w, h, fill="#FFFFFF", stroke=BORDER, radius=16, dashed=False):
        dash = ' stroke-dasharray="8 6"' if dashed else ''
        self.parts.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{radius}" fill="{fill}" stroke="{stroke}" stroke-width="2"{dash}/>')

    def text(self, x, y, text, size=24, color=INK, weight=400, anchor="start"):
        self.parts.append(f'<text x="{x}" y="{y}" font-size="{size}" font-weight="{weight}" fill="{color}" text-anchor="{anchor}">{escape(text)}</text>')

    def lines(self, x, y, lines, size=22, color=SECONDARY, gap=30, anchor="start", weight=400):
        for index, line in enumerate(lines):
            self.text(x, y + index * gap, line, size, color, weight, anchor)

    def path(self, points, color=LINE, dashed=False, arrow=True, width=2.5):
        d = "M" + " L".join(f"{x} {y}" for x, y in points)
        dash = ' stroke-dasharray="7 6"' if dashed else ''
        marker = f' marker-end="url(#arrow-{color[1:]})"' if arrow else ''
        self.parts.append(f'<path d="{d}" fill="none" stroke="{color}" stroke-width="{width}" stroke-linejoin="round" stroke-linecap="round"{dash}{marker}/>')

    def node(self, x, y, title, body=(), w=368, h=100, fill="#FFFFFF", dashed=False, accent=False):
        self.rect(x, y, w, h, fill=fill, stroke=GREEN if accent else BORDER, dashed=dashed)
        self.text(x + 24, y + 37, title, 26, FOREST if accent else INK, 600)
        self.lines(x + 24, y + 70, body, size=21, gap=29)

    def decision(self, x, y, title, detail, w=368, h=112):
        cx, cy = x + w / 2, y + h / 2
        self.parts.append(f'<path d="M{cx} {y} L{x+w} {cy} L{cx} {y+h} L{x} {cy} Z" fill="{MINT}" stroke="{GREEN}" stroke-width="2"/>')
        self.text(cx, cy - 4 if detail else cy + 8, title, 25, FOREST, 600, "middle")
        if detail:
            self.text(cx, cy + 24, detail, 18, SECONDARY, 400, "middle")

    def label(self, x, y, text, color=SECONDARY, anchor="middle", size=20):
        # White backing prevents connector strokes from running through labels.
        width = len(text) * size * 0.53 + 20
        left = x - width / 2 if anchor == "middle" else x - 10
        self.rect(left, y - size + 2, width, size + 11, fill="#FFFFFF", stroke="none", radius=5)
        self.text(x, y, text, size, color, 500, anchor)

    def finish(self, filename):
        self.parts.extend(['</g>', '</svg>'])
        path = ROOT / filename
        path.write_text("\n".join(self.parts) + "\n")
        print(path)


def workflow():
    d = Diagram(1440, 2510, "ServeQ customer service workflow", "Three swimlanes show customer actions, backend operations, and business owner actions. Appointment and live queue paths converge at service delivery. Payment collection and delay/cancellation are separate operations. This is a target mobile workflow.")
    d.text(56, 65, "SERVEQ  /  WORKFLOW DESIGN", 21, GREEN, 600)
    d.text(56, 126, "From discovery to a completed visit", 48, INK, 600)
    d.text(56, 166, "Target customer mobile flow · Appointment and live queue journeys", 23, SECONDARY)

    lanes = [(56, "CUSTOMER APP", "Choose, reserve, and track"), (512, "BACKEND", "Validate, persist, and publish"), (968, "BUSINESS OWNER", "Prepare venue and deliver service")]
    for x, title, sub in lanes:
        d.rect(x, 205, 416, 1758, fill=PALE, stroke="none", radius=18)
        d.text(x + 24, 247, title, 23, FOREST, 600)
        d.text(x + 24, 279, sub, 20, SECONDARY)

    # Connectors are laid down first so node surfaces keep text unobstructed.
    d.path([(264, 398), (264, 440)])
    d.path([(448, 354), (536, 354)])
    d.label(492, 333, "auth", size=18)
    d.path([(448, 492), (536, 492)])
    d.path([(992, 419), (948, 419), (948, 492), (904, 492)], dashed=True)
    d.path([(720, 544), (720, 561), (264, 561), (264, 585)])
    d.path([(264, 685), (264, 708)])
    d.path([(264, 808), (264, 840)], color=GREEN)
    d.path([(120, 758), (64, 758), (64, 1220), (80, 1220)], color=GREEN)
    d.label(112, 1127, "Live queue", color=GREEN, anchor="start")

    d.path([(448, 895), (536, 895)], color=GREEN)
    d.path([(720, 951), (720, 990)], color=GREEN)
    d.label(747, 978, "Yes", color=GREEN, anchor="start", size=18)
    d.path([(536, 1042), (448, 1042)], color=GREEN)
    d.path([(904, 895), (936, 895), (936, 818), (264, 818), (264, 840)], color=AMBER, dashed=True)
    d.label(720, 811, "Unavailable → choose another slot", color=AMBER, size=19)

    d.path([(448, 1220), (536, 1220)], color=GREEN)
    d.path([(720, 1276), (720, 1315)], color=GREEN)
    d.label(747, 1303, "Yes", color=GREEN, anchor="start", size=18)
    d.path([(536, 1370), (448, 1370)], color=GREEN)
    d.path([(904, 1220), (936, 1220), (936, 1140), (264, 1140), (264, 1165)], color=AMBER, dashed=True)
    d.label(722, 1133, "Full or closed → choose another option", color=AMBER, size=19)

    # Both records become operational work for the venue.
    d.path([(904, 1042), (952, 1042), (952, 1472), (1176, 1472), (1176, 1490)], color=LINE)
    d.path([(904, 1370), (952, 1370)], arrow=False)
    d.label(1132, 1459, "New visit appears in portal", size=20)
    d.path([(264, 1094), (264, 1120), (460, 1120), (460, 1470), (264, 1470), (264, 1490)], color=LINE, dashed=True)
    d.path([(264, 1425), (264, 1490)], color=GREEN)
    d.path([(992, 1544), (904, 1544)], color=GREEN)
    d.path([(536, 1544), (448, 1544)], color=GREEN)
    d.path([(1176, 1598), (1176, 1660)], color=GREEN)
    d.path([(992, 1714), (904, 1714)], color=GREEN)
    d.path([(536, 1714), (448, 1714)], color=GREEN)
    d.path([(264, 1768), (264, 1820)], color=GREEN)
    d.label(264, 1803, "Completed visits only", color=GREEN, size=19)

    # Counter collection is deliberately independent of the service-completion path.
    d.path([(992, 1873), (904, 1873)], color=LINE)
    d.path([(536, 1873), (492, 1873), (492, 1714), (448, 1714)], color=LINE, dashed=True)

    d.node(80, 310, "Welcome and sign in", ["First-launch onboarding · session"], h=88, dashed=True)
    d.node(536, 310, "Verify customer session", ["Identity and customer role"], h=88)
    d.node(80, 440, "Choose location", ["Current location or manual area"], h=104)
    d.node(536, 440, "Load venue directory", ["Location, services, availability"], h=104)
    d.node(80, 585, "Find venue and services", ["Salon / clinic · professional"], h=100)
    d.decision(120, 708, "Choose visit type", "", w=288, h=100)

    d.node(992, 310, "Prepare venue", ["Owner email verified", "Active business subscription", "Services, staff, and hours", "Publish venue and accept visits"], h=218)
    d.text(1016, 575, "Venue readiness enables discovery", 20, SECONDARY)

    d.node(80, 840, "Book appointment", ["Choose time · review · confirm"], h=110, accent=True)
    d.decision(536, 839, "Slot available?", "Services · time · capacity")
    d.node(536, 990, "Create Booking", ["confirmed · payment pending"], h=104)
    d.node(80, 990, "Appointment confirmed", ["Shown under upcoming visits"], h=104, fill=MINT)

    d.node(80, 1165, "Join live queue", ["Review wait · confirm services"], h=110, accent=True)
    d.decision(536, 1164, "Can customer join?", "Capacity and eligibility")
    d.node(536, 1315, "Create linked records", ["Booking + Queue entry", "Assign staff and recalculate ETA"], h=110)
    d.node(80, 1315, "Show live queue pass", ["Position · estimate · professional", "May be serving immediately"], h=110, fill=MINT)

    d.node(992, 1490, "Start service / call next", ["Authorized owner operation"], h=108, accent=True)
    d.node(536, 1490, "Update visit and queue", ["Save state · send live events"], h=108)
    d.node(80, 1490, "Track current visit", ["Waiting or being served"], h=108, fill=MINT)

    d.node(992, 1660, "Complete service", ["Advance queue when applicable"], h=108, accent=True)
    d.node(536, 1660, "Complete Booking", ["Remove queue entry if present"], h=108)
    d.node(80, 1660, "Visit history", ["Keep the completed visit record"], h=108)
    d.node(80, 1820, "Rate and review", ["One review for the completed visit"], h=108)
    d.node(992, 1820, "Record counter collection", ["Separate authorized action"], h=108)
    d.node(536, 1820, "Payment pending → paid", ["Update the visit payment record"], h=108)

    # Exceptions are a separate lane band, so they do not obscure the happy paths.
    d.rect(56, 2008, 1328, 286, fill="#FFFCF5", stroke="#E7D8BB", radius=18)
    d.text(80, 2050, "DELAY, CANCELLATION, OR LEAVING", 22, AMBER, 600)
    d.path([(992, 2139), (904, 2139)], color=AMBER)
    d.path([(536, 2114), (448, 2114)], color=AMBER)
    d.path([(448, 2180), (536, 2180)], color=AMBER)
    d.label(492, 2102, "alert", color=AMBER, size=17)
    d.label(492, 2206, "choice", color=AMBER, size=17)
    d.node(80, 2083, "Choose what to do", ["Accept the revised estimate", "or cancel / leave the queue"], h=154, fill="#FFFDF8")
    d.node(536, 2083, "Apply the chosen action", ["Keep visit OR cancel Booking", "Remove queue entry if present", "Retain cancelled visit in history"], h=154, fill="#FFFDF8")
    d.node(992, 2083, "Report service delay", ["Extend time or change staff", "Backend revises the estimate"], h=154, fill="#FFFDF8")
    d.text(80, 2272, "Cancelled visits remain in history and do not become review-eligible.", 21, AMBER)

    d.text(56, 2356, "Read this diagram", 24, INK, 600)
    d.lines(56, 2396, ["Green arrows: primary journey. Amber dashed arrows: retry or exception. Dashed boxes: planned mobile work.", "Payment collection is independent of service completion. Foreground updates use Socket.IO.", "Target design: mobile shell, stable tickets, atomic related writes, and reliable native push still need implementation."], size=21, gap=31)
    d.finish("serveq-customer-workflow.svg")


def architecture():
    d = Diagram(1440, 1840, "ServeQ system architecture", "Customer web and planned Capacitor app, owner and admin portals connect to the same Express modular monolith. Domain services use MongoDB, Socket.IO, and external providers. Native background push is planned.")
    d.text(56, 65, "SERVEQ  /  SYSTEM ARCHITECTURE", 21, GREEN, 600)
    d.text(56, 126, "One backend. Every customer journey.", 48, INK, 600)
    d.text(56, 166, "Existing modular monolith with a planned Capacitor customer app", 23, SECONDARY)

    d.text(56, 236, "01  CLIENT EXPERIENCES", 22, GREEN, 600)
    clients = [(56, "Customer website", ["Existing React application"], False), (392, "Customer mobile", ["React + Capacitor · planned"], True), (728, "Owner portal", ["Venue operations"], False), (1064, "Admin portal", ["Platform moderation"], False)]
    for x, title, body, dashed in clients:
        d.node(x, 268, title, body, w=320, h=110, dashed=dashed)

    for x, _, _, dashed in clients:
        d.path([(x + 160, 378), (x + 160, 434), (720, 434)], dashed=dashed, arrow=False)
    d.path([(720, 434), (720, 578)], color=GREEN)
    d.label(720, 472, "HTTPS REST requests and responses", color=GREEN, size=23)

    d.rect(56, 506, 1328, 568, fill=PALE, stroke=BORDER, radius=20)
    d.text(80, 548, "02  NODE.JS BACKEND · ONE PROCESS", 22, GREEN, 600)
    d.path([(720, 506), (720, 578)], color=GREEN)
    d.node(410, 578, "Express API gateway", ["Authentication · permissions · validation · rate limits", "Public endpoints and protected domain routes"], w=620, h=126, accent=True)
    d.path([(720, 704), (720, 744), (386, 744), (386, 790)], color=GREEN)
    d.path([(720, 744), (1054, 744), (1054, 790)], color=GREEN)
    d.node(80, 790, "Core operations", ["Business and service catalog", "Bookings and live queues", "Payments and owner subscriptions"], w=612, h=190)
    d.node(748, 790, "Supporting domains", ["Reviews · coupons · chat · support", "Maps · analytics · chatbot · waitlist", "Authentication, OTP, email, and health"], w=612, h=190)
    d.path([(386, 980), (386, 1030), (720, 1030)], arrow=False)
    d.path([(1054, 980), (1054, 1030), (720, 1030)], arrow=False)
    d.path([(720, 1030), (720, 1160)], arrow=False)
    d.path([(720, 1160), (256, 1160), (256, 1190)], color=GREEN)
    d.path([(720, 1160), (1184, 1160), (1184, 1190)], color=GREEN)
    d.path([(720, 1160), (488, 1160), (488, 1288), (520, 1288)], color=GREEN)
    d.path([(488, 1288), (488, 1530), (520, 1530)], dashed=True)

    d.text(56, 1138, "03  DATA, LIVE DELIVERY, AND PROVIDERS", 22, GREEN, 600)

    d.rect(56, 1190, 400, 306, fill=MINT, stroke=BORDER, radius=18)
    d.text(80, 1232, "MongoDB", 30, FOREST, 600)
    d.lines(80, 1280, ["Users and businesses", "Bookings and live queue entries", "Reviews, coupons, chat messages", "OTP, support, and waitlist records"], size=21, gap=37)
    d.text(80, 1463, "Database accessed through the API only", 20, SECONDARY)

    d.node(520, 1190, "Socket.IO", ["Foreground queue and visit updates", "Owner operations and presence", "Reconnect → refresh current visit"], w=400, h=190, fill=MINT)
    d.node(520, 1430, "Native push — planned", ["Durable events + delivery worker", "Device registration · APNs / FCM", "Open visit and fetch latest state"], w=400, h=190, dashed=True)

    d.rect(984, 1190, 400, 430, fill="#FFFFFF", stroke=BORDER, radius=18)
    d.text(1008, 1232, "External integrations", 27, INK, 600)
    d.lines(1008, 1280, ["Google OAuth / Firebase Phone", "Google Maps / Nominatim", "Razorpay orders and webhooks", "SMTP or Resend email", "Twilio SMS", "OpenRouter assistance / analytics"], size=21, gap=48)

    # Dedicated outer return rail avoids intersecting modules and their labels.
    d.path([(920, 1288), (952, 1288), (952, 1150), (1415, 1150), (1415, 226), (552, 226), (552, 268)], color=LINE, dashed=True)
    d.path([(920, 1530), (952, 1530), (952, 1288)], color=LINE, dashed=True, arrow=False)
    d.label(1058, 218, "Live events / native alerts", size=19)

    d.text(56, 1690, "Architecture boundaries", 24, INK, 600)
    d.lines(56, 1730, ["Solid components exist in the repository. Dashed components are planned mobile integrations.", "The modules run together; they are not separate deployed microservices.", "Payment verification, authorization, atomic writes, and reliable push need the corrections described in the design."], size=21, gap=32)
    d.finish("serveq-system-architecture.svg")


if __name__ == "__main__":
    ROOT.mkdir(parents=True, exist_ok=True)
    workflow()
    architecture()
