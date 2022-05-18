
import { VALISPACE_URL, VALISPACE_TOKEN, VALISPACE_USERNAME, VALISPACE_PROJECT } from './constants';
import { fetch } from '@forge/api';


const requestValispace = async ( path, method = 'GET') => {
    return fetch(
        VALISPACE_URL + path + '?project=' + VALISPACE_PROJECT, {
        method: method,
        headers: {
            'Authorization': 'Bearer ' + VALISPACE_TOKEN
        }
    })
}

const downloadRequirements = async () => {
    const result = await requestValispace('rest/requirements', 'GET');
    return result.json();
}

const downloadVM = async () => {
    const result = await requestValispace('rest/requirements/verification-methods', 'GET')
    return result.json();
}

const downloadVC = async () => {
    const result = await requestValispace('', 'GET');
    return result.json();
}

const getStates = async () => {
    const result = await requestValispace('rest/requirements/states/', 'GET');
    return result.json();
}
const getSpecificState = async (state) => {
    //Returns only one state with provided name
    let data = await getStates();
    console.log(data)
    data = data.filter( element => element.name.toLowerCase() === state);
    if ( data.length == 1 ){
        return data[0];
    }
    throw `Found more than one ${state} state`;
}

export const getFilteredRequirements = async () => {
    const data = await downloadRequirements();
    const final_state = await getSpecificState('final');
    return data.filter( element => element.state === final_state.id);
}
