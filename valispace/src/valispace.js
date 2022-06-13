import api, { fetch, storage } from '@forge/api';





const valispaceAskToken = async (deployment_url, username, passwd) => {
    //  var dialog = DocumentApp.getUi()

    var tokenUrl = deployment_url + 'o/token/'
    var data = {
      grant_type: 'password',
      client_id: 'ValispaceREST',
      username: username,
      password: passwd
    };
    const url = new URL(tokenUrl);

    for (let i in data) {
        url.searchParams.append(i, data[i]);
    }

    var options = {
        method: 'POST'
    };
    var response = await fetch(url.toString(), options);
    var responseData = await response.json();
    if (!responseData || !responseData.access_token) {
        throw new Error(`Login Error`)
    }
    var accessToken = responseData.access_token;
    return accessToken
}

const valispaceGetToken = async (deployment_url) => {
    const connected = await checkValispaceConnexion();
    console.log(connected)
    let accessToken = await storage.getSecret("access_token")
    if (!connected || accessToken === undefined) {
        const VALISPACE_USERNAME = await storage.getSecret("valispace_username");
        const VALISPACE_PASSWORD = await storage.getSecret("valispace_password");
        accessToken = await valispaceAskToken(
            deployment_url,
            VALISPACE_USERNAME,
            VALISPACE_PASSWORD
        );

      storage.setSecret("access_token", accessToken);
    }
    return accessToken;
}

 export const checkValispaceConnexion = async () => {

    const response = await requestValispace('project');
    console.log(response.text())
    return response.ok;

}

export const requestValispace = async ( path, method = 'GET', url_params = {}, data = null ) => {
    const VALISPACE_URL = await storage.getSecret('valispace_url');
    const VALISPACE_PROJECT = await storage.getSecret('valispace_project');


    const url = new URL(VALISPACE_URL + path);
    url.searchParams.append('project', VALISPACE_PROJECT);

    for (let i in url_params) {
        url.searchParams.append(i, url_params[i]);
    }


    // const VALISPACE_TOKEN = await storage.getSecret("access_token")
    const VALISPACE_TOKEN = await valispaceGetToken(VALISPACE_URL)

    const fetch_options = {
        method: method,
        headers: {
            'Authorization': 'Bearer ' + VALISPACE_TOKEN
        }
    };

    if (data !== null) {
        fetch_options['body'] = JSON.stringify(data);
    }
    console.log(fetch_options);




    return fetch(
        url.toString(), fetch_options)
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

    const states = await getStates();
    let final_id = -1;
    for (let state of states) {
        if (state['name'] == state) {
            final_id = state['id'];
            break;
        }
    }
    return final_id
}

export const getFilteredRequirements = async () => {
    const data = await downloadRequirements();
    const final_state = await getSpecificState('final');
    return data.filter( element => element.state === final_state.id);
}

export const generateReqName = (props) => {
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

const bulkCreateCards = async ( data ) => {
    return api.asApp().requestJira(route`/rest/api/3/issue/bulk`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        body: data
    });
}

const getValiReqMapping = async (project_name) => {
    const req_mapping = {};

    let result = await api.asApp().requestJira(route`/rest/api/3/search?jql=project=${project_name} and issue.property[valiReq] is not empty &startAt=0&maxResults=8000&fields=issue`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
    });

    const data = await result.json();
    console.log(data)
    for (let issue of data.issues) {
        // console.log(`Issue: ${issue.key}`);

        result = await getIssueValiReq(issue.key);
        const props = await result.json();
        const req_identifier = generateReqName(props);

        // console.log(req_identifier);

        if (req_identifier != null) {
            req_mapping[req_identifier] = issue.key;
        }
    }

    return req_mapping;
}

export const updateOrCreateCards = async () => {
    req_mapping = await getValiReqMapping('VTS');
    const reqs = await getVerificationActivities();

    const new_reqs = [];

    // identifier is a mix of different ids
    for (let identifier in reqs) {
        if (identifier in req_mapping) {
            // apparently there's no bulk update in jira
            const data = reqs[identifier];

            console.log(JSON.stringify(data, null, '\t'));

            console.log(`identifier = ${identifier}`);
            console.log(`reqs[identifier] = ${reqs[identifier]}`);
            console.log(`req_mapping[identifier] = ${req_mapping[identifier]}`);



            console.log(`/rest/api/3/issue/${req_mapping[identifier]}`);

            let result = await api.asApp().requestJira(route`/rest/api/3/issue/${req_mapping[identifier]}`, {
                method: 'PUT',
                headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });

            console.log(await result.text());
        }
        else {
            new_reqs.push(reqs[identifier]);
        }
}

if (new_reqs.length > 0) {
    const bulk_update_format = {
        "issueUpdates": new_reqs,
    };

    // console.log(JSON.stringify(bulk_update_format));

    const result = await bulkCreateCards(JSON.stringify(bulk_update_format));
    console.log(await result.text());
}
else {
    console.log("No new requirements.");
}
}
export const getVerificationActivities = async () => {
    const new_requirements = {};

    // get final state id
    const final_id = getSpecificState('Final')

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

                new_requirements[generateReqName(card_data.properties)] = card_data;
            }
        }
    }

    return new_requirements;
}
