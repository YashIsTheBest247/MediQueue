import os
import smtplib
import threading
from email.message import EmailMessage

SMTP_HOST = os.environ.get("MEDIQUEUE_SMTP_HOST", "")
SMTP_PORT = int(os.environ.get("MEDIQUEUE_SMTP_PORT", "587"))
SMTP_USER = os.environ.get("MEDIQUEUE_SMTP_USER", "")
SMTP_PASS = os.environ.get("MEDIQUEUE_SMTP_PASS", "")
SMTP_SSL = os.environ.get("MEDIQUEUE_SMTP_SSL", "").lower() in ("1", "true", "yes")
MAIL_FROM = os.environ.get("MEDIQUEUE_MAIL_FROM", SMTP_USER or "no-reply@mediqueue.app")


def is_configured() -> bool:
    return bool(SMTP_HOST and SMTP_USER and SMTP_PASS)


def _deliver(to_addr: str, subject: str, text: str, html: str) -> None:
    msg = EmailMessage()
    msg["From"] = MAIL_FROM
    msg["To"] = to_addr
    msg["Subject"] = subject
    msg.set_content(text)
    if html:
        msg.add_alternative(html, subtype="html")
    try:
        if SMTP_SSL:
            with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, timeout=15) as s:
                s.login(SMTP_USER, SMTP_PASS)
                s.send_message(msg)
        else:
            with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=15) as s:
                s.starttls()
                s.login(SMTP_USER, SMTP_PASS)
                s.send_message(msg)
    except Exception as exc:
        print(f"[mailer] failed to send to {to_addr}: {exc}")


def send_email(to_addr: str, subject: str, text: str, html: str = "") -> bool:
    if not is_configured() or not to_addr:
        return False
    threading.Thread(
        target=_deliver, args=(to_addr, subject, text, html), daemon=True
    ).start()
    return True


def you_are_next_email(clinic_name: str, token_number: int):
    subject = f"You're next at {clinic_name} — token #{token_number}"
    text = (
        f"The patient ahead of you has just been called.\n\n"
        f"Your token #{token_number} is next at {clinic_name}.\n"
        f"Please head to the clinic now so you don't miss your turn.\n\n"
        f"— MediQueue"
    )
    html = (
        f"<div style=\"font-family:system-ui,Segoe UI,Arial,sans-serif;max-width:480px;"
        f"margin:0 auto;padding:24px;color:#0f2b30\">"
        f"<h2 style=\"margin:0 0 6px;color:#127c8a\">You're next</h2>"
        f"<p style=\"margin:0 0 16px;color:#3a5961\">The patient ahead of you has just "
        f"been called at <strong>{clinic_name}</strong>.</p>"
        f"<div style=\"background:#eaf6f7;border:1px solid #cfe9ec;border-radius:14px;"
        f"padding:18px;text-align:center;margin-bottom:16px\">"
        f"<div style=\"font-size:13px;color:#3a5961;margin-bottom:4px\">Your token</div>"
        f"<div style=\"font-size:38px;font-weight:800;color:#127c8a\">#{token_number}</div>"
        f"</div>"
        f"<p style=\"margin:0;color:#3a5961\">Please head to the clinic now so you don't "
        f"miss your turn.</p>"
        f"<p style=\"margin:20px 0 0;font-size:12px;color:#8aa2a8\">— MediQueue</p>"
        f"</div>"
    )
    return subject, text, html
