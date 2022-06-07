
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

export const getVerificationActivities = async (project_id) => {
    // get final state id
    let result = await requestValispace(`requirements/states/?project=${project_id}`, 'GET');
    const states = result.json();
    let final_id = -1;
    for (let i in states) {
        const state = states[i];
        if (state['name'] == 'Final') {
            final_id = state['id'];
            break;
        }
    }

    // get verification statuses
    // result = await requestValispace('requirements/verification-statuses/', 'GET');
    // const verification_statuses = result.json();

    result = await requestValispace(`requirements/verification-methods/?project=${project_id}`, 'GET');
    const verification_methods = result.json();

    const verification_methods_by_id = {}
    for (let i in verification_methods) {
        const verification_method = verification_methods[i];
        verification_methods_by_id[verification_method['id']] = verification_methods[i]
    }

    // get project requirements
    result = await requestValispace(`requirements/?project=${project_id}`);
    const project_requirements = result.json();

    for (let i in project_requirements) {
        const requirement = project_requirements[i];

        // skip requirements that aren't final
        if (requirement['state'] != final_id) {
            continue;
        }

        // for all verification methods
        const vm_ids = requirement['verification_methods'];
        for (let j in vm_ids) {
            const vm_id = vm_ids[j];
            result = await requestValispace(`requirements/requirement-vms/?ids=${vm_id}`);
            const vm = result.json()[0];
            const verification_method_name = verification_methods_by_id[vm['method']]['name'];

            // for all components in verification method
            for (let k in vm['component_vms']) {
                const component_vms_id = vm['component_vms'][k];
                result = await requestValispace(`requirements/component-vms/${component_vms_id}`);
                cvms = result.json();
                result = await requestValispace(`components/${cvms['component']}`);
                component = result.json();

                // generate task text
                const task_text = `${requirement['identifier']}, ${verification_method_name}, ${component['name']}`;

                createTask(task_text);
            }
        }
    }
}
