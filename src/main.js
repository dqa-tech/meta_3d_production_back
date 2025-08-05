/**
 * Main entry point for the 3D Data Management System
 * This file coordinates initialization and menu setup
 */

function onOpen() {
  createMenu();
  initializeSheet();
  initializeAgentsSheet();
}

function onInstall() {
  onOpen();
}

/**
 * Get all functions from a module
 * Note: In Google Apps Script, we can't use modules, 
 * so all functions need to be in the global scope
 */