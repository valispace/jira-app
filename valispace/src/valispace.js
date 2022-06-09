import { VALISPACE_URL, VALISPACE_TOKEN, VALISPACE_USERNAME, VALISPACE_PROJECT } from './constants';
import { fetch } from '@forge/api';


export const requestValispace = async ( path, method = 'GET', url_params = {}, data = null ) => {
    const url = new URL(VALISPACE_URL + path);
    url.searchParams.append('project', VALISPACE_PROJECT);

    for (let i in url_params) {
        url.searchParams.append(i, url_params[i]);
    }

    const fetch_options = {
        method: method,
        headers: {
            'Authorization': 'Bearer ' + VALISPACE_TOKEN
        }
    };

    if (data !== null) {
        fetch_options['body'] = JSON.stringify(data);
    }

    return fetch(
        url.toString(), fetch_options);
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
    // console.log(data)
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

export const valiReqIdentifier = (props) => {
    if ('value' in props &&
    'requirement_id' in props.value &&
    'verification_method_id' in props.value &&
    'component_vms_id' in props.value) {
        return `${props.value.requirement_id},${props.value.verification_method_id},${props.value.component_vms_id}`;
    }
    else {
        return null
    }
}

export const getVerificationActivities = async () => {
    const new_requirements = {};

    // get final state id
    let result = await requestValispace(`rest/requirements/states/`, 'GET');
    const states = await result.json();
    let final_id = -1;
    for (let state of states) {
        if (state['name'] == 'Final') {
            final_id = state['id'];
            break;
        }
    }

    // get verification statuses
    // result = await requestValispace('rest/requirements/verification-statuses/', 'GET');
    // const verification_statuses = result.json();

    result = await requestValispace(`rest/requirements/verification-methods/`, 'GET');
    const verification_methods = await result.json();

    const verification_methods_by_id = {};
    for (let verification_method of verification_methods) {
        verification_methods_by_id[verification_method['id']] = verification_method;
    }

    // get project requirements
    result = await requestValispace('rest/requirements/');
    const project_requirements = await result.json();

    for (let requirement of project_requirements) {
        // skip requirements that aren't final
        if (requirement['state'] != final_id) {
            continue;
        }

        // for all verification methods
        const vm_ids = requirement['verification_methods'];
        for (let vm_id of vm_ids) {
            result = await requestValispace(`rest/requirements/requirement-vms/`, 'GET', {'ids': vm_id});
            const vms = await result.json();
            const vm = vms[0];
            const verification_method_name = verification_methods_by_id[vm['method']]['name'];

            console.log(`verification_method_name = ${verification_method_name}`);

            // for all components in verification method
            for (let component_vms_id of vm['component_vms']) {
                result = await requestValispace(`rest/requirements/component-vms/${component_vms_id}`);
                const cvms = await result.json();
                result = await requestValispace(`rest/components/${cvms['component']}`);
                const component = await result.json();

                // generate task data
                const task_text = `${requirement['identifier']}, ${verification_method_name}, ${component['name']}`;
                // console.log(`Imaginary task: ${task_text}`);

                const card_data = {
                    'fields': {
                        'summary': task_text,
                        'project': {
                            'key': 'VTS'
                        },
                        'issuetype': {
                            'id': '10001',
                            'description': task_text
                        },
                    },
                    'properties': [
                        {
                            'key' : 'valiReq',
                            'value': {
                                'requirement_id': requirement['id'],
                                'verification_method_id': vm_id,
                                'component_vms_id': component_vms_id,
                            }
                        }
                    ]
                };

                new_requirements[valiReqIdentifier(card_data.properties)] = card_data;
            }
        }
    }

    return new_requirements;
}
