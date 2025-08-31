#!/usr/bin/env python3
"""
Manual Browser Auth Drive Downloader
Uses manual OAuth flow - no credentials.json needed
"""

import os
import requests
import urllib.parse
from urllib.parse import parse_qs, urlparse

# These are public OAuth credentials for testing (not secure for production)
CLIENT_ID = "your-client-id"
CLIENT_SECRET = "your-client-secret"
REDIRECT_URI = "urn:ietf:wg:oauth:2.0:oob"  # Manual copy-paste flow

def get_auth_url():
    """Generate OAuth authorization URL"""
    base_url = "https://accounts.google.com/o/oauth2/auth"
    params = {
        "client_id": CLIENT_ID,
        "redirect_uri": REDIRECT_URI,
        "scope": "https://www.googleapis.com/auth/drive.readonly",
        "response_type": "code",
        "access_type": "offline"
    }
    
    return f"{base_url}?{urllib.parse.urlencode(params)}"

def exchange_code_for_token(auth_code):
    """Exchange authorization code for access token"""
    token_url = "https://oauth2.googleapis.com/token"
    data = {
        "client_id": CLIENT_ID,
        "client_secret": CLIENT_SECRET,
        "redirect_uri": REDIRECT_URI,
        "grant_type": "authorization_code",
        "code": auth_code
    }
    
    response = requests.post(token_url, data=data)
    return response.json()

def main():
    print("❌ This method requires valid OAuth credentials")
    print("💡 Try using 'gdown' instead:")
    print("   pip install gdown")
    print("   gdown --folder 'https://drive.google.com/drive/folders/YOUR_FOLDER_ID'")

if __name__ == '__main__':
    main()