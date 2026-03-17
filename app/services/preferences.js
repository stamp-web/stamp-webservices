import extend from 'node.extend';
import PersistentCollection from './persistent-collection.js';
import preference from '../model/preference.js';

const preferences = extend(true, {}, new PersistentCollection(), function () {
    return {
        collectionName: 'preferences',
        fieldDefinition: preference
    };
}());

export default preferences;