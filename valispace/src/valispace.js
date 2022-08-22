import api, { fetch, storage, route } from "@forge/api";

const valispaceAskToken = async (deployment_url, username, passwd) => {
	//  var dialog = DocumentApp.getUi()

	var tokenUrl = deployment_url + "o/token/";
	var data = {
		grant_type: "password",
		client_id: "ValispaceREST",
		username: username,
		password: passwd,
	};
	const url = new URL(tokenUrl);

	for (let i in data) {
		url.searchParams.append(i, data[i]);
	}

	var options = {
		method: "POST",
	};
	var response = await fetch(url.toString(), options);
	var responseData = await response.json();
	if (!responseData || !responseData.access_token) {
		throw new Error(`Login Error`);
	}
	var accessToken = responseData.access_token;
	return accessToken;
};

const valispaceGetToken = async (deployment_url) => {
	let accessToken = await storage.getSecret("access_token");
	const connected = await checkValispaceConnexion(deployment_url, accessToken);
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
};

export const checkValispaceConnexion = async (deployment_url, accessToken) => {
	//Temp solution, tells it to get the secret stored to try and auth. Otherwise it creates a loop
	const response = await (async () => {
		const VALISPACE_TOKEN = accessToken;
		const url = new URL(deployment_url + "rest/own-profile/");
		const fetch_options = {
			method: "GET",
			headers: {
				Authorization: "Bearer " + VALISPACE_TOKEN,
			},
		};
		return fetch(url.toString(), fetch_options);
	})();
	return response.ok;
};

export const requestValispace = async (
	path,
	method = "GET",
	url_params = {},
	data = null,
	token = "request"
) => {
	let valispace_url = await storage.getSecret("valispace_url");
	if (valispace_url[valispace_url.length - 1] != '/') {
		valispace_url += '/';
	}

	if (valispace_url.substr(0, 4) != 'http') {
		valispace_url = 'https://' + valispace_url;
	}

	const VALISPACE_PROJECT = await storage.getSecret("valispace_project");

	const url = new URL(valispace_url + path);
	url.searchParams.append("project", VALISPACE_PROJECT);

	for (let i in url_params) {
		url.searchParams.append(i, url_params[i]);
	}

	let VALISPACE_TOKEN = await valispaceGetToken(valispace_url);

	const fetch_options = {
		method: method,
		headers: {
			Authorization: "Bearer " + VALISPACE_TOKEN,
		},
	};

	if (data !== null) {
		fetch_options["body"] = JSON.stringify(data);
	}

	return fetch(url.toString(), fetch_options);
};

const downloadRequirements = async () => {
	const result = await requestValispace("rest/requirements?clean_text=text", "GET");
	return result.json();
};

const downloadVM = async () => {
	const result = await requestValispace(
		"rest/requirements/verification-methods",
		"GET"
	);
	return result.json();
};

const downloadVC = async () => {
	const result = await requestValispace("", "GET");
	return result.json();
};

const getStates = async () => {
	const result = await requestValispace("rest/vstates/", "GET");
	return result.json();
};

const getVerificationStatuses = async () => {
	const result = await requestValispace("rest/requirements/verification-statuses/", "GET");
	return result.json();
};

const createVerificationStatuses = async (data) => {
	const result = await requestValispace(
		"rest/requirements/verification-statuses/",
		"POST",
		{},
		data);
	return result.json();
};

const getSpecificState = async (state_name) => {
	const states = await getStates();
	let final_id = -1;
	for (let state of states) {
		if (state["name"] == state_name) {
			final_id = state["id"];
			break;
		}
	}
	return final_id;
};

const getFilteredRequirementsByState = async (state_name) => {
	const data = await downloadRequirements();
	const final_state = await getSpecificState(state_name);
	return data.filter((element) => element.state === final_state);
};

const generateReqName = (props) => {
	if (
		props &&
		"requirement_id" in props &&
		"verification_method_id" in props &&
		"component_vms_id" in props
	) {
		return `${props.requirement_id}, ${props.verification_method_id}, ${props.component_vms_id}`;
	} else {
		return null;
	}
};

const bulkCreateCards = async (data) => {
	return api.asApp().requestJira(route`/rest/api/3/issue/bulk`, {
		method: "POST",
		headers: {
			Accept: "application/json",
			"Content-Type": "application/json",
		},
		body: JSON.stringify(data),
	});
};

const bulkUpdateCards = async (data) => {
	for (let card of data) {
		const [[key, value]] = Object.entries(card);
		await updateJiraCard(key, value);
	}
};

const updateJiraCard = (issueId, cardData) => {
	return api.asApp().requestJira(route`/rest/api/3/issue/${issueId}`, {
		method: "PUT",
		headers: {
			Accept: "application/json",
			"Content-Type": "application/json",
		},
		body: JSON.stringify(cardData),
	});
};

export const updateStatus = async (event, change) => {
	console.log("Getting verification status...");
	const verification_statuses = await getVerificationStatuses();
	const status_map = {};

	for (let vs of verification_statuses) {
		status_map[vs.name] = vs.id;
	}

	let valiReq = await getIssueValiReq(event.issue.key);
	const props = await valiReq.json();


	let new_status;

	if (change.toString in status_map) {
		new_status = status_map[change.toString];
	}
	else {
		console.log("Creating new verification status...");
		let data = await createVerificationStatuses({ name: change.toString, abbr: change.toString[0] });
		new_status = data.id;
	}

	await requestValispace(
		`rest/requirements/component-vms/${props.value.component_vms_id}/`,
		"PATCH",
		{},
		{ status: new_status }
	);
};

const getIssue = async (issue_key) => {
	return api
		.asApp()
		.requestJira(route`/rest/api/3/issue/${issue_key}`, {
			method: "GET",
			headers: {
				Accept: "application/json",
				"Content-Type": "application/json",
			},
		});
};

const getIssueValiReq = async (issue_key) => {
	return api
		.asApp()
		.requestJira(route`/rest/api/3/issue/${issue_key}/properties/valiReq`, {
			method: "GET",
			headers: {
				Accept: "application/json",
				"Content-Type": "application/json",
			},
		});
};

const removeIssueValiReq = async (issue_key) => {
	return api
		.asApp()
		.requestJira(route`/rest/api/3/issue/${issue_key}/properties/valiReq`, {
			method: "DELETE",
			headers: {
				Accept: "application/json",
				"Content-Type": "application/json",
			},
		});
};

const dictById = (array, index) => {
	const arrayById = {};
	for (let item of array) {
		arrayById[item[index]] = item;
	}
	return arrayById;
};

const getProjectKey = () => {
	return storage.getSecret("jira_project_key");
};



export const getValiReqMapping = async () => {
	const req_mapping = {};
	const project_key = await getProjectKey();
	let i = 0, data, props, req_identifier, result, bodyData;
	while (true) {

		bodyData = `{
		"jql": "project=${project_key}",
			"maxResults": 100,
		"fields": [
			"summary",
			"description"
		],
			"startAt": ${100 * i},
		"properties": [
			"valiReq"
		]
	}`;

		result = await api.asApp().requestJira(route`/rest/api/3/search`, {
			method: "POST",
			headers: {
				Accept: "application/json",
				"Content-Type": "application/json",
			},
			body: bodyData,
		});

		console.log("Requested query")
		data = await result.json();

		if (data.issues.length == 0) { break; }

		for (let issue of data.issues) {
			// result = await getIssueValiReq(issue.key);
			props = issue.properties['valiReq'];
			req_identifier = generateReqName(props);
			if (req_identifier != null) {
				req_mapping[req_identifier] = issue;
			} else {

				console.log("NOT FOUND IDENTIFIER");
			}
		}
		i++;
	}

	return req_mapping;
};

export const updateOrCreateCards = async () => {
	const cards_reqs_mapping = await getValiReqMapping();
	const validVerificationActivities = await getVerificationActivities();

	const project_key = await getProjectKey();
	const issueTypeId = await getIssueTypeID("Task");

	const newCards = [];
	const updateCards = [];

	for (let data of validVerificationActivities) {
		let card_info = generateTaskData(data, project_key, issueTypeId);
		let card_id = `${data.requirement["id"]}, ${data.req_vm["id"]}, ${data.cvm["id"]}`;
		if (card_id in cards_reqs_mapping) {
			let oldCardData = cards_reqs_mapping[card_id];
			delete cards_reqs_mapping[card_id];// remove card from list
			console.log(oldCardData);
			let id = oldCardData.key;

			if (oldCardData.properties['valiReq'].data_used !== card_info['properties'][0].value.data_used) {
				let updateObj = {};
				updateObj[id] = card_info;
				updateCards.push(updateObj);
			}
		} else {
			newCards.push(card_info);
		}
	}

	if (updateCards.length > 0) {
		const result = await bulkUpdateCards(updateCards);
		console.log(
			`Updated ${updateCards.length} requirement${
				updateCards.length > 1 ? "s" : ""
			}`
		);
	} else {
		console.log("No requirements to update.");
	}

	if (newCards.length > 0) {
		let bulk_create_format = {};
		let result;
		const JIRA_LIMIT = 50
		for (let i = 0; i < newCards.length; i += JIRA_LIMIT) {

			bulk_create_format = {
				issueUpdates: newCards.slice(i, i + JIRA_LIMIT),
			};
			result = await bulkCreateCards(bulk_create_format);
		}

		console.log(
			`Created ${newCards.length} requirement${newCards.length > 1 ? "s" : ""}`,
			result
		);
	} else {
		console.log("No new requirements.");
	}

	await handleDeletedVerificationActivities(cards_reqs_mapping);
};

const handleDeletedVerificationActivities = async (cards_reqs_mapping) => {

	const nDeleteActivities = Object.keys(cards_reqs_mapping).length;

	if (!nDeleteActivities) {
		console.log("No activities deleted.");
		return;
	}

	console.log(`Deleting ${nDeleteActivities} activities.`)

	for (let card_id in cards_reqs_mapping) {
		const issueKey = cards_reqs_mapping[card_id].key;

		console.log("Removing activity", card_id, ". Transitioning issue", issueKey);

		await removeIssueValiReq(issueKey);
		await transitionIssueTo(issueKey, 'done');
	}
}

const getIssueTypeID = async (name) => {
	let id = 0;
	const projectId = await storage.getSecret("jira_project_id");
	const response = await api
		.asApp()
		.requestJira(route`/rest/api/3/issuetype/project?projectId=${projectId}`, {
			headers: {
				Accept: "application/json",
			},
		});
	const issueTypes = await response.json();
	for (const issueType of issueTypes) {
		if (issueType.name === name || issueType === 0) {
			id = issueType.id;
		}
	}
	return id;
};

/**
 * @param {number|string} issueIdOrKey 
 * @param {string} statusCategoryKey
 */
 const transitionIssueTo = async (issueIdOrKey, statusCategoryKey) => {

	const transitionId = await getTransitionId(issueIdOrKey, statusCategoryKey);
	if (!transitionId) {
		console.log(`The transition to ${statusCategoryKey} was not found for the issue ${issueIdOrKey}, adding a comment to the issue`);
		await addCommentToJiraCard(issueIdOrKey, `Unable to move this issue since the transition to '${statusCategoryKey}' was not found`);
		return;
	}

	await api.asApp().requestJira(route`/rest/api/3/issue/${issueIdOrKey}/transitions`, {
		method: "POST",
		headers: {
			"Accept": "application/json",
			"Content-Type": "application/json",
		},
		body: JSON.stringify({ transition: { id: transitionId } }),
	});
};

/**
 * @param {number|string} issueIdOrKey
 * @param {string} statusCategoryKey 
 */
const getTransitionId = async (issueIdOrKey, statusCategoryKey) => {
	const transitions = await getIssueTransitions(issueIdOrKey);
	const transition = transitions.find(t => t.to.statusCategory.key === statusCategoryKey);
	return transition?.id;
}

/**
 * @param {number|string} issueIdOrKey
 * @returns {Promise<object[]>}
 */
const getIssueTransitions = async (issueIdOrKey) => {
	const response = await api.asApp().requestJira(route`/rest/api/3/issue/${issueIdOrKey}/transitions`, {
		headers: { 'Accept': 'application/json' }
	});
	const body = await response.json();
	return body?.transitions ?? [];
}

/**
 * @param {number|string} issueIdOrKey 
 * @param {string} comment
 */
const addCommentToJiraCard = (issueIdOrKey, comment) => {

	const requestBody = {
		"body": {
			"type": "doc",
			"version": 1,
			"content": [
				{
					"type": "paragraph",
					"content": [
						{
							"type": "text",
							"text": comment
						}
					]
				}
			]
		}
	};

	return api.asApp().requestJira(route`/rest/api/3/issue/${issueIdOrKey}/comment`, {
		method: 'POST',
		headers: {
			'Accept': 'application/json',
			'Content-Type': 'application/json'
		},
		body: JSON.stringify(requestBody)
	});
}

const generateTaskData = (data, project_key, issueTypeId) => {
	// generate task data
	const task_text = `${data.requirement["identifier"]}, ${data.vm["name"]}, ${data.component["name"]}`;
	const card_data = {
		fields: {
			summary: task_text,
			project: {
				key: project_key,
			},
			issuetype: {
				id: issueTypeId,
				description: task_text,
			},
			description: {

				type: "doc",
				version: 1,
				content: [
					{
						type: "paragraph",
						content: [
							{
								type: "text",
								text: data.requirement['text']
							}
						]
					}
				]
			}
		},
		properties: [
			{
				key: "valiReq",
				value: {
					requirement_id: data.requirement["id"],
					verification_method_id: data.req_vm["id"],
					component_vms_id: data.cvm["id"],
					data_used: JSON.stringify({
						requirement: data.requirement["id"],
						req_vm: data.req_vm["id"],
						component_vms_id: data.cvm["id"],
						description: data.requirement['text']
					})
				},
			},
		],
	};
	return card_data;
};

export const getVerificationActivities = async () => {
	const related_data = [];

	const verification_methods = await downloadVM();

	// get project requirements
	const requirements_filtered = await getFilteredRequirementsByState("Final");
	const vms = await (
		await requestValispace(`rest/requirements/requirement-vms/`, "GET")
	).json();

	const component_vms = await (
		await requestValispace(`rest/requirements/component-vms/`)
	).json();

	const components = await (await requestValispace(`rest/components/`)).json();

	const verification_methods_by_id = dictById(verification_methods, "id");
	const vms_by_id = dictById(vms, "id");
	const component_vms_by_id = dictById(component_vms, "id");
	const components_by_id = dictById(components, "id");

	for (let requirement of requirements_filtered) {
		// for all verification methods
		const vm_ids = requirement["verification_methods"];
		for (let vm_id of vm_ids) {
			const req_vm = vms_by_id[vm_id];
			const vm = verification_methods_by_id[req_vm["method"]];

			// for all components in verification method
			for (let component_vms_id of req_vm["component_vms"]) {
				const cvm = component_vms_by_id[component_vms_id];
				const component = components_by_id[cvm["component"]];

				//Push all the data of the relationship
				related_data.push({ requirement, req_vm, cvm, component, vm });
			}
		}
	}

	return related_data;
};
