"""
=============================================================================
 VoicePay — Day 7 Email Notifications
 Sends escalation alerts to the owner via SMTP2GO API
=============================================================================
"""

from __future__ import annotations

import logging
import os
from typing import Any

import aiohttp

logger = logging.getLogger("voicepay.email")

SMTP2GO_API_KEY = os.environ.get("SMTP2GO_API_KEY", "")
SMTP2GO_BASE_URL = os.environ.get("SMTP2GO_BASE_URL", "https://api.smtp2go.com/v3")
FROM_EMAIL = os.environ.get("SMTP2GO_FROM_EMAIL", "noreply@trndinn.com")
FROM_NAME = os.environ.get("SMTP2GO_FROM_NAME", "VoicePay Escalations")
NOTIFY_EMAIL = os.environ.get("ESCALATION_NOTIFY_EMAIL", "amanahujajsr@gmail.com")


async def send_escalation_email(
    *,
    reference_id: str,
    esc_type: str,
    urgency: str,
    summary: str,
    caller_name: str | None = None,
    language: str = "en",
    what_checked: str | None = None,
    trigger_phrases: list[str] | None = None,
) -> bool:
    """
    Send an email notification when an escalation ticket is created.
    Returns True if sent successfully, False otherwise.
    Non-blocking, non-fatal — a failed email should never crash the voice session.
    """
    if not SMTP2GO_API_KEY:
        logger.warning("SMTP2GO_API_KEY not set — skipping email notification")
        return False

    urgency_emoji = {
        "critical": "🚨",
        "high": "🔴",
        "medium": "🟡",
        "low": "🟢",
    }
    emoji = urgency_emoji.get(urgency, "⚪")

    subject = f"{emoji} [{urgency.upper()}] VoicePay Escalation: {reference_id} — {esc_type.title()}"

    html_body = f"""
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; background: #0a0e1a; color: #e5e7eb; padding: 32px; border-radius: 12px;">
        <div style="border-bottom: 2px solid #f5a623; padding-bottom: 16px; margin-bottom: 24px;">
            <h1 style="color: #f5a623; margin: 0; font-size: 20px;">VoicePay Escalation Alert</h1>
            <p style="color: #9ca3af; margin: 4px 0 0 0; font-size: 13px;">A caller needs human help</p>
        </div>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
            <tr>
                <td style="padding: 8px 0; color: #9ca3af; width: 140px;">Reference ID</td>
                <td style="padding: 8px 0; color: #ffffff; font-weight: 600; font-family: monospace; font-size: 16px;">{reference_id}</td>
            </tr>
            <tr>
                <td style="padding: 8px 0; color: #9ca3af;">Type</td>
                <td style="padding: 8px 0;">
                    <span style="background: {'#ef44441a' if esc_type == 'fraud' else '#3b82f61a'}; color: {'#fca5a5' if esc_type == 'fraud' else '#93c5fd'}; padding: 2px 10px; border-radius: 12px; font-size: 13px;">{esc_type.title()}</span>
                </td>
            </tr>
            <tr>
                <td style="padding: 8px 0; color: #9ca3af;">Urgency</td>
                <td style="padding: 8px 0;">
                    <span style="font-size: 14px;">{emoji} {urgency.upper()}</span>
                </td>
            </tr>
            <tr>
                <td style="padding: 8px 0; color: #9ca3af;">Caller</td>
                <td style="padding: 8px 0; color: #ffffff;">{caller_name or 'Anonymous'}</td>
            </tr>
            <tr>
                <td style="padding: 8px 0; color: #9ca3af;">Language</td>
                <td style="padding: 8px 0; color: #ffffff;">{language}</td>
            </tr>
            <tr>
                <td style="padding: 8px 0; color: #9ca3af;">Follow-up</td>
                <td style="padding: 8px 0; color: #ffffff;">Callback (phone)</td>
            </tr>
        </table>

        <div style="background: #111827; border: 1px solid #1f2937; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
            <h3 style="color: #f5a623; margin: 0 0 8px 0; font-size: 14px;">Summary</h3>
            <p style="color: #d1d5db; margin: 0; line-height: 1.6; font-size: 14px;">{summary}</p>
        </div>

        {f'''<div style="background: #111827; border: 1px solid #1f2937; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
            <h3 style="color: #9ca3af; margin: 0 0 8px 0; font-size: 14px;">What Agent Checked</h3>
            <p style="color: #9ca3af; margin: 0; font-size: 13px;">{what_checked}</p>
        </div>''' if what_checked else ''}

        {f'''<div style="margin-bottom: 16px;">
            <h3 style="color: #9ca3af; margin: 0 0 8px 0; font-size: 14px;">Trigger Phrases</h3>
            <p style="color: #fca5a5; font-size: 13px;">{"&nbsp;|&nbsp;".join(trigger_phrases)}</p>
        </div>''' if trigger_phrases else ''}

        <div style="border-top: 1px solid #1f2937; padding-top: 16px; margin-top: 24px;">
            <p style="color: #6b7280; font-size: 12px; margin: 0;">
                View and manage this ticket on the <strong>VoicePay Dashboard</strong>.<br>
                Response expected within: <strong>{'1 hour' if urgency == 'critical' else '4 hours' if urgency == 'high' else '24 hours'}</strong>
            </p>
        </div>
    </div>
    """

    text_body = f"""
VoicePay Escalation Alert
========================
Reference: {reference_id}
Type: {esc_type}
Urgency: {urgency.upper()}
Caller: {caller_name or 'Anonymous'}
Language: {language}

Summary:
{summary}

{f'What Agent Checked: {what_checked}' if what_checked else ''}
{f'Trigger Phrases: {", ".join(trigger_phrases)}' if trigger_phrases else ''}

Response expected within: {'1 hour' if urgency == 'critical' else '4 hours' if urgency == 'high' else '24 hours'}
"""

    payload = {
        "api_key": SMTP2GO_API_KEY,
        "to": [f"{NOTIFY_EMAIL}"],
        "sender": f"{FROM_NAME} <{FROM_EMAIL}>",
        "subject": subject,
        "html_body": html_body,
        "text_body": text_body,
    }

    try:
        import certifi
        import ssl
        ssl_ctx = ssl.create_default_context(cafile=certifi.where())
        connector = aiohttp.TCPConnector(ssl=ssl_ctx)

        async with aiohttp.ClientSession(connector=connector) as session:
            async with session.post(
                f"{SMTP2GO_BASE_URL}/email/send",
                json=payload,
                timeout=aiohttp.ClientTimeout(total=10),
            ) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    if data.get("data", {}).get("succeeded", 0) > 0:
                        logger.info(
                            "EMAIL SENT: escalation=%s to=%s",
                            reference_id, NOTIFY_EMAIL,
                        )
                        return True
                    else:
                        logger.warning("SMTP2GO response not succeeded: %s", data)
                        return False
                else:
                    body = await resp.text()
                    logger.warning(
                        "SMTP2GO failed: status=%d body=%s",
                        resp.status, body[:200],
                    )
                    return False
    except Exception as exc:
        logger.warning("Email send failed (non-fatal): %s", exc)
        return False
