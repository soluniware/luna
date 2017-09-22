/**
 * Electron's Main process
 */

import electron from 'electron';
import {
  app,
  BrowserWindow,
  ipcMain,
  dialog
} from 'electron';

const cwd = process.cwd();
const NODE_ENV = process.env.NODE_ENV;
const config = require('./config');
const electronStore = require('electron-store');
const shell = require('./shell');
const winston = require('winston');

let platform = process.platform;
let mainWindow = null;
let debug = /--debug/.test(process.argv[4]);

global.logger = new winston.Logger({
  level: 'info',
  transports: [
    new(winston.transports.Console)(),
    new(winston.transports.File)({
      filename: 'log.log'
    })
  ]
});

if (NODE_ENV === 'development' && debug) {
  /** https://github.com/yan-foto/electron-reload - hard reset, starts a new process **/
  require('electron-reload')(cwd, {
    electron: require('electron'),
    ignored: /log.log|node_modules|dist|test|build|[\/\\]\./
  });
}

//instatiate electron store
const store = new electronStore();

// set store and config as global objects
// so we can call them via remote.getGlobal(name) in a renderer process
global.store = store;
global.config = config;

function createMainWindow() {
  let screenSize = electron.screen.getPrimaryDisplay().size;

  //create main window
  mainWindow = new BrowserWindow({
    width: screenSize.width,
    height: screenSize.height,
    show: true,
    resizable: true
  });

  //load index.html
  mainWindow.loadURL('file://' + __dirname + '/index.html');

  if (process.env.NODE_ENV === 'development' && debug) {
    //open devtools
    mainWindow.openDevTools();

    //inspect element on right click
    ipcMain.on('inspect-element', function(event, coords) {
      if (mainWindow) {
        MainWindow.inspectElement(coords.x, coords.y);
      }
    });
  }

  //on close event
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

/**
 * IPC events
 */
ipcMain.on('get-global-modules', (event) => {
  shell.doCmd({}, (modules) => {
    event.sender.send('get-global-modules-reply', modules);
  });
});

ipcMain.on('get-package-info', (event, pkg) => {
  let pkgName = pkg.name;
  if(!pkgName) {
    event.sender.send('get-package-info-reply', false);
    return;
  }
  shell.doCmd({
    cmd: 'info',
    pkgName: pkgName,
    parameters: false
  }, (data) => {
    event.sender.send('get-package-info-reply', data);
  });
});

ipcMain.on('get-latest-version', (event, pkg) => {
  let pkgName = pkg.name;
  if(!pkgName) {
    event.sender.send('get-latest-version-reply', false);
    return;
  }
  shell.doCmd({
    cmd: 'view',
    pkgName: pkgName,
    parameters: 'version'
  }, (data) => {
    event.sender.send('get-latest-version-reply', data);
  });
})
/**
 * register app events
 */
app.on('window-all-closed', () => {
  if (process.platform != 'darwin') {
    app.quit();
  }
});

app.on('ready', () => {
  createMainWindow();
});

app.on('gpu-process-crashed', (event, killed) => {
  throw new Error('gpu crached or is killed');
})

process.on('uncaughtException', function(err) {
  console.log(err);
});

// GPU AMD fix for Linux
if(platform === 'linux') {
  app.commandLine.appendSwitch('disable-gpu-compositing');
}