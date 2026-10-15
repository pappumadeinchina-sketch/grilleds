#!/usr/bin/env python3
"""
PulseChat Raspberry Pi + Bluetooth Smart Glasses Bridge Client
==============================================================
Designed for:
- Raspberry Pi Zero 2W / Pi 4 / Pi 5 running Raspberry Pi OS
- Bluetooth Glasses with Microphone + Bone-Conduction Speakers (e.g., Ray-Ban Meta style, Bose Frames, or custom BT headset module)
- Automatic voice command capture, speech-to-text (or push-to-talk audio file upload), and incoming call alerts via speech synthesis (TTS)
"""

import sys
import time
import argparse
import requests
import json

class PulseChatGlassesClient:
    def __init__(self, server_url, api_key):
        self.server_url = server_url.rstrip('/')
        self.api_key = api_key
        self.headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "User-Agent": "PulseChat-RaspberryPi-Glasses/1.0"
        }

    def check_status(self):
        """Polls server for incoming calls and unread messages to alert wearer via bone conduction speaker."""
        try:
            url = f"{self.server_url}/api/v1/iot/glasses/status"
            res = requests.get(url, headers=self.headers, timeout=5)
            if res.status_code == 200:
                data = res.json()
                return data
            else:
                print(f"[ERROR] Status check failed ({res.status_code}): {res.text}")
                return None
        except Exception as e:
            print(f"[EXCEPTION] Status check connection error: {e}")
            return None

    def send_voice_message(self, recipient_username, transcribed_text, audio_url=None):
        """Sends a message to a recipient captured by the smart glasses microphone."""
        try:
            url = f"{self.server_url}/api/v1/iot/glasses/voice-command"
            payload = {
                "to": recipient_username,
                "transcript": transcribed_text,
                "audioUrl": audio_url
            }
            res = requests.post(url, headers=self.headers, json=payload, timeout=5)
            if res.status_code == 200:
                print(f"[GLASSES SUCCESS] Sent message to @{recipient_username}: '{transcribed_text}'")
                return True
            else:
                print(f"[ERROR] Failed to send: {res.text}")
                return False
        except Exception as e:
            print(f"[EXCEPTION] Voice message error: {e}")
            return False

    def trigger_quick_call(self, recipient_username):
        """One-touch call button on the glasses frame triggers an audio call on PulseChat."""
        try:
            url = f"{self.server_url}/api/v1/iot/glasses/quick-call"
            payload = {"to": recipient_username}
            res = requests.post(url, headers=self.headers, json=payload, timeout=5)
            if res.status_code == 200:
                print(f"[GLASSES CALL] Calling @{recipient_username}...")
                return True
            else:
                print(f"[ERROR] Failed to trigger call: {res.text}")
                return False
        except Exception as e:
            print(f"[EXCEPTION] Quick call error: {e}")
            return False

    def run_daemon_loop(self, poll_interval=3):
        """Continuous background loop running on the Pi while paired with Bluetooth glasses."""
        print(f"============================================================")
        print(f"👓 PulseChat Smart Glasses + Pi IoT Daemon Active")
        print(f"🌐 Server: {self.server_url}")
        print(f"⚡ Status: Monitoring incoming calls & voice alerts...")
        print(f"============================================================")

        last_call_id = None

        while True:
            status = self.check_status()
            if status:
                active_call = status.get('activeIncomingCall')
                if active_call:
                    call_id = active_call.get('callId')
                    caller = active_call.get('callerName') or active_call.get('callerUsername')
                    if call_id != last_call_id:
                        last_call_id = call_id
                        print(f"🔔 [GLASSES SPEAKER ALERT] Incoming call from {caller}!")
                        # In production on Pi, you can trigger 'espeak' or 'pico2wave' or play a chime:
                        # os.system(f'espeak "Incoming call from {caller}"')
                else:
                    last_call_id = None

            time.sleep(poll_interval)


def main():
    parser = argparse.ArgumentParser(description="PulseChat Pi + Glasses IoT Bridge")
    parser.add_argument("--server", default="http://localhost:3000", help="PulseChat Server URL (e.g. https://your-app.onrender.com)")
    parser.add_argument("--api-key", required=True, help="User API Key from PulseChat Settings")
    parser.add_argument("--send-to", help="Send a test message to username")
    parser.add_argument("--message", help="Voice transcript message text")
    parser.add_argument("--call-to", help="Trigger a quick call to username")
    parser.add_argument("--daemon", action="store_true", help="Run background monitoring daemon on Pi")

    args = parser.parse_args()
    client = PulseChatGlassesClient(args.server, args.api_key)

    if args.send_to and args.message:
        client.send_voice_message(args.send_to, args.message)
    elif args.call_to:
        client.trigger_quick_call(args.call_to)
    elif args.daemon:
        client.run_daemon_loop()
    else:
        # Default run status verification
        res = client.check_status()
        print("Glasses Status Result:", json.dumps(res, indent=2))


if __name__ == "__main__":
    main()
