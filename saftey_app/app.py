# app.py
from flask import Flask, request, jsonify
from flask_cors import CORS
import os
from dotenv import load_dotenv # To load environment variables from a .env file

# Load environment variables from .env file
# This line should be at the very top, after imports, to ensure variables are loaded before use.
load_dotenv()

app = Flask(__name__)
CORS(app) # Enable CORS for all routes

# --- Twilio Configuration (for SMS) ---
# You'll need to install the Twilio Python library: pip install twilio
# Get these from your Twilio Console: https://www.twilio.com/console
TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN")
TWILIO_PHONE_NUMBER = os.getenv("TWILIO_PHONE_NUMBER") # Your Twilio phone number (e.g., "+15017122661")

# --- Email Configuration (for Gmail example) ---
# You'll need to enable "App Passwords" for your Gmail account if you have 2FA enabled:
# https://support.google.com/accounts/answer/185833
SENDER_EMAIL = os.getenv("SENDER_EMAIL") # Your Gmail address
SENDER_EMAIL_PASSWORD = os.getenv("SENDER_EMAIL_PASSWORD") # The App Password you generated

# Import Twilio and email libraries conditionally, so they don't break if not installed
try:
    from twilio.rest import Client
except ImportError:
    Client = None
    print("Twilio library not found. SMS sending will be simulated.")

try:
    import smtplib
    from email.mime.text import MIMEText
    from email.mime.multipart import MIMEMultipart
except ImportError:
    smtplib = None
    MIMEText = None
    MIMEMultipart = None
    print("Email libraries not found. Email sending will be simulated.")


@app.route('/')
def home():
    """
    A simple home route to confirm the server is running.
    """
    return "SOS Safety Backend is running!"

@app.route('/api/sos', methods=['POST'])
def receive_sos_alert():
    """
    Receives an SOS alert from the frontend.
    Expects a JSON payload with latitude, longitude, timestamp, and emergencyContacts.
    """
    if not request.is_json:
        return jsonify({"error": "Request must be JSON"}), 400

    data = request.get_json()

    latitude = data.get('latitude')
    longitude = data.get('longitude')
    timestamp = data.get('timestamp')
    emergency_contacts = data.get('emergencyContacts', [])

    # Basic validation
    if not all([latitude, longitude, timestamp]):
        return jsonify({"error": "Missing location or timestamp data"}), 400

    if not emergency_contacts:
        return jsonify({"error": "No emergency contacts provided"}), 400

    print(f"--- SOS Alert Received ---")
    print(f"Location: Latitude {latitude}, Longitude {longitude}")
    print(f"Timestamp: {timestamp}")
    print(f"Emergency Contacts: {emergency_contacts}")

    # Construct the alert message.
    google_maps_link = f"https://www.google.com/maps/search/?api=1&query={latitude},{longitude}"
    alert_message = (
        f"EMERGENCY! I need help. My current location is: "
        f"Latitude: {latitude}, Longitude: {longitude}. "
        f"View on Map: {google_maps_link}. "
        f"Timestamp: {timestamp}. Please respond immediately."
    )

    sent_to = []
    for contact in emergency_contacts:
        contact_name = contact.get('name', 'Unknown Contact')
        contact_value = contact.get('value') # This could be a phone number or email

        if not contact_value:
            print(f"Skipping contact '{contact_name}' due to missing value.")
            continue

        # Simple check to differentiate between phone and email (can be more robust)
        if '@' in contact_value: # Likely an email address
            if SENDER_EMAIL and SENDER_EMAIL_PASSWORD and smtplib and MIMEText and MIMEMultipart:
                print(f"Attempting to send real email to {contact_name} ({contact_value})...")
                try:
                    msg = MIMEMultipart()
                    msg['From'] = SENDER_EMAIL
                    msg['To'] = contact_value
                    msg['Subject'] = "URGENT: SOS Alert from Guardian Angel App!"
                    msg.attach(MIMEText(alert_message, 'plain'))

                    # For Gmail, use smtp.gmail.com on port 465 (SSL)
                    server = smtplib.SMTP_SSL('smtp.gmail.com', 465)
                    server.login(SENDER_EMAIL, SENDER_EMAIL_PASSWORD)
                    server.sendmail(SENDER_EMAIL, contact_value, msg.as_string())
                    server.quit()
                    print(f"Real email sent to {contact_name} ({contact_value})")
                    sent_to.append(f"Email to {contact_name}")
                except Exception as e:
                    print(f"Failed to send real email to {contact_name}: {e}")
                    print(f"Full Email Error Details (e.args): {e.args}") # Added for email debugging
                    sent_to.append(f"Failed Email to {contact_name} (Error: {e})")
            else:
                print(f"Simulating sending email to {contact_name} ({contact_value})... (Email credentials/libs not configured)")
                sent_to.append(f"Simulated Email to {contact_name}")

        else: # Likely a phone number
            # Basic validation for phone number format (can be more robust)
            # Twilio expects numbers in E.164 format (e.g., +1234567890)
            if not contact_value.startswith('+'):
                print(f"Warning: Phone number '{contact_value}' for {contact_name} does not start with '+'. Twilio requires E.164 format.")
                # You might want to try to prepend a default country code if you know it,
                # or enforce it on the frontend. For now, we'll just warn.

            if TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN and TWILIO_PHONE_NUMBER and Client:
                print(f"Attempting to send real SMS to {contact_name} ({contact_value})...")
                try:
                    client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
                    message = client.messages.create(
                        to=contact_value,
                        from_=TWILIO_PHONE_NUMBER,
                        body=alert_message
                    )
                    print(f"Real SMS sent to {contact_name} (SID: {message.sid})")
                    sent_to.append(f"SMS to {contact_name}")
                except Exception as e:
                    # These lines are crucial for debugging Twilio errors
                    print(f"Failed to send real SMS to {contact_name}: {e}")
                    print(f"Full Twilio Error Details (e.args): {e.args}")
                    sent_to.append(f"Failed SMS to {contact_name} (Error: {e})")
            else:
                print(f"Simulating sending SMS to {contact_name} ({contact_value})... (Twilio credentials/lib not configured)")
                sent_to.append(f"Simulated SMS to {contact_name}")

    response_message = f"SOS alert processed. Notifications sent/simulated for: {', '.join(sent_to) if sent_to else 'no contacts'}. Check your server console for details."
    return jsonify({"message": response_message, "status": "success", "sent_to": sent_to}), 200

if __name__ == '__main__':
    app.run(debug=True, port=5000)
