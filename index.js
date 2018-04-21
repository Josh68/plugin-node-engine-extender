'use strict';
const appRoot = require('app-root-path')
const path = require('path')
const fs = require('fs-extra')
const glob = require('glob')
const pluginName = 'plugin-node-engine-extender'
const configPath = 'extensionPath'

const loadExtensions = (extPath) => {
  let extension = require(`${appRoot}/${extPath}`)

  if (!extension) {
    console.log('Extension failed to load')
    process.exit(1)
  }

  if (extension.default) {
    extension = extension.default
  } 

  return extension
}

function onPatternIterate(patternlab) {
  const extension = patternlab.extension
  patternlab.patterns = patternlab.patterns.map((pattern) => {
    pattern.engine.engine = extension(pattern.engine.engine)
    return pattern;
  })
  return patternlab
}

function registerEvents(patternlab) {
  patternlab.events.on('patternlab-pattern-iteration-end', onPatternIterate)
}

/**
* A single place to define the frontend configuration
* This configuration is outputted to the frontend explicitly as well as included in the plugins object.
*
*/
function getPluginFrontendConfig () {
  return {
    'name': 'pattern-lab\/' + pluginName, 
    'templates': [],
    'stylesheets': [],
    'javascripts': ['patternlab-components\/pattern-lab\/' + pluginName +
      '\/js\/' + pluginName + '.js'],
    'onready': '',
    'callback': ''
  }
}

/**
* The entry point for the plugin. You should not have to alter this code much under many circumstances.
* Instead, alter getPluginFrontendConfig() and registerEvents() methods
  */
function pluginInit(patternlab) {
  if (!patternlab) {
    console.error('patternlab object not provided to plugin-init')
    process.exit(1)
  }
  const extPath = patternlab.config[configPath]
  if (!extPath) {
    console.log(`no extension path at config.${configPath}`)
    process.exit(1)
  }
  
  //write the plugin json to public/patternlab-components
  var pluginConfig = getPluginFrontendConfig();
  var pluginConfigPathName = path.resolve(patternlab.config.paths.public.root,
    'patternlab-components', 'packages');

  try {
    fs.outputFileSync(pluginConfigPathName + '/' + pluginName + '.json',
      JSON.stringify(pluginConfig, null, 2));
  } catch (ex) {
    console.trace(
      'plugin-node-engine-extender: Error occurred while writing pluginFile configuration');
    console.log(ex);
  }

  //add the plugin config to the patternlab-object
  if (!patternlab.plugins) {
    patternlab.plugins = [];
  }
  patternlab.plugins.push(pluginConfig);
  
  var pluginFiles = glob.sync(__dirname + '/dist/**/*');
  if (pluginFiles && pluginFiles.length > 0) {
    for (var i = 0; i < pluginFiles.length; i++) {
      try {
        var fileStat = fs.statSync(pluginFiles[i]);
        if (fileStat.isFile()) {
          var relativePath = path.relative(__dirname, pluginFiles[i]).replace('dist', '');
          var writePath = path.join(patternlab.config.paths.public.root,
            'patternlab-components', 'pattern-lab', pluginName, relativePath);
          var tabJSFileContents = fs.readFileSync(pluginFiles[i], 'utf8');
          fs.outputFileSync(writePath, tabJSFileContents);
        }
      } catch (ex) {
        console.trace(
          'plugin-node-tab: Error occurred while copying pluginFile',
          pluginFiles[i]);
        console.log(ex);
      }
    }
  }
  
  //setup listeners if not already active. we also enable and set the plugin as initialized
  if (!patternlab.config.plugins) {
    patternlab.config.plugins = {};
  }

  //setup listeners if not already active
  if (patternlab.config.plugins[pluginName] !== undefined &&
      patternlab.config.plugins[pluginName].enabled &&
      !patternlab.config.plugins[pluginName].initialized) {

     //register events
     registerEvents(patternlab);
     patternlab.extension = loadExtensions(extPath)

     //set the plugin initialized flag to true to indicate it is installed and ready
     patternlab.config.plugins[pluginName].initialized = true;
   }
}

module.exports = pluginInit
