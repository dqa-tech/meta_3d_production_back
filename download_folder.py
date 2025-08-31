#!/usr/bin/env python3
"""
Simple Google Drive Folder Downloader
Downloads entire folder from Google Drive by folder ID
"""

import os
import io
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload
import pickle

# Scopes for Google Drive API
SCOPES = ['https://www.googleapis.com/auth/drive.readonly']

def authenticate():
    """Authenticate with Google Drive API using browser OAuth"""
    creds = None
    
    # Load existing credentials
    if os.path.exists('token.pickle'):
        with open('token.pickle', 'rb') as token:
            creds = pickle.load(token)
    
    # If no valid credentials, get new ones
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            print("🔐 Opening browser for Google Drive authentication...")
            print("📋 Please sign in and authorize access to Google Drive")
            
            # Create OAuth flow - opens browser automatically
            flow = InstalledAppFlow.from_client_secrets_file(
                'credentials.json', SCOPES)
            
            # This will open your default browser for authentication
            creds = flow.run_local_server(
                port=8080,  # You can change this port if needed
                open_browser=True  # Automatically opens browser
            )
            
            print("✅ Authentication successful!")
        
        # Save credentials for next time
        with open('token.pickle', 'wb') as token:
            pickle.dump(creds, token)
    
    return build('drive', 'v3', credentials=creds)

def download_folder(service, folder_id, local_path='.'):
    """Download entire folder from Google Drive"""
    
    # Get folder info
    folder = service.files().get(fileId=folder_id).execute()
    folder_name = folder['name']
    
    print(f"Downloading folder: {folder_name}")
    
    # Create local folder
    local_folder_path = os.path.join(local_path, folder_name)
    os.makedirs(local_folder_path, exist_ok=True)
    
    # Download all contents recursively
    download_folder_contents(service, folder_id, local_folder_path)
    
    print(f"✅ Download complete: {local_folder_path}")
    return local_folder_path

def download_folder_contents(service, folder_id, local_path):
    """Recursively download folder contents"""
    
    # Get all files and folders in this directory
    results = service.files().list(
        q=f"'{folder_id}' in parents and trashed=false",
        fields="files(id, name, mimeType)"
    ).execute()
    
    items = results.get('files', [])
    
    for item in items:
        item_name = item['name']
        item_id = item['id']
        mime_type = item['mimeType']
        
        if mime_type == 'application/vnd.google-apps.folder':
            # It's a folder - create locally and recurse
            subfolder_path = os.path.join(local_path, item_name)
            os.makedirs(subfolder_path, exist_ok=True)
            print(f"📁 Created folder: {item_name}")
            download_folder_contents(service, item_id, subfolder_path)
        else:
            # It's a file - download it
            download_file(service, item_id, item_name, local_path)

def download_file(service, file_id, file_name, local_path):
    """Download a single file"""
    try:
        # Get file metadata
        file_metadata = service.files().get(fileId=file_id).execute()
        mime_type = file_metadata.get('mimeType')
        
        # Handle Google Workspace files (Docs, Sheets, etc.)
        if mime_type.startswith('application/vnd.google-apps.'):
            print(f"⚠️  Skipping Google Workspace file: {file_name}")
            return
        
        # Download regular file
        request = service.files().get_media(fileId=file_id)
        file_path = os.path.join(local_path, file_name)
        
        with open(file_path, 'wb') as f:
            downloader = MediaIoBaseDownload(f, request)
            done = False
            while done is False:
                status, done = downloader.next_chunk()
        
        print(f"📄 Downloaded: {file_name}")
        
    except Exception as e:
        print(f"❌ Failed to download {file_name}: {str(e)}")

def main():
    """Main function"""
    # Replace with your folder ID
    FOLDER_ID = input("Enter Google Drive folder ID: ").strip()
    
    if not FOLDER_ID:
        print("No folder ID provided")
        return
    
    try:
        # Authenticate and download
        service = authenticate()
        download_folder(service, FOLDER_ID)
        
    except Exception as e:
        print(f"❌ Error: {str(e)}")

if __name__ == '__main__':
    main()