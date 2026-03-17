import preferences from "../services/preferences.js";
import preference from '../model/preference.js';
import restInterfaces from './rest-interfaces.js';
import extend from 'node.extend';

const RESOURCE_PATH = "/preferences";

export const configure = (app, basePath) => {
    const prefsRest = extend(true, {}, new restInterfaces());
    prefsRest.initialize(app, `${basePath}${RESOURCE_PATH}`, preferences, preference);
};