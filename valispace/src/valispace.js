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
  const connected = await checkValispaceConnexion(deployment_url);
  let accessToken = await storage.getSecret("access_token");
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

export const checkValispaceConnexion = async (deployment_url) => {
  //Temp solution, tells it to get the secret stored to try and auth. Otherwise it creates a loop
  const response = await (async () => {
    const VALISPACE_TOKEN = await storage.getSecret("access_token");
    const url = new URL(deployment_url + "/rest/own-profile/");
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
  const result = await requestValispace("rest/requirements", "GET");
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
  const result = await requestValispace("rest/requirements/states/", "GET");
  return result.json();
};

const getVerificationStatuses = async () => {
  const result = await requestValispace("rest/requirements/verification-statuses/", "GET");
  console.log(result);
  return result.json();
};

const createVerificationStatuses = async (data) => {
  const result = await requestValispace(
    "rest/requirements/verification-statuses/",
    "PUT",
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
    "value" in props &&
    "requirement_id" in props.value &&
    "verification_method_id" in props.value &&
    "component_vms_id" in props.value
  ) {
    return `${props.value.requirement_id}, ${props.value.verification_method_id}, ${props.value.component_vms_id}`;
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
    console.log(key, value);
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

export const updateStatus = async ({ event, change }) => {
  console.log("updateStatus");
  console.log("Getting verification status...");

  const verification_statuses = await getVerificationStatuses();
  console.log(verification_statuses);

  const status_map = {};

  for (let vs of verification_statuses) {
    status_map[vs.name] = vs.id;
  }

  console.log(status_map);

  let valiReq = await getIssueValiReq(event.issue.key);
  const props = await valiReq.json();
  const req_identifier = props.value.requirement_id;

  const request_data = {
    comment: `<p>${change.fromString} -> ${change.toString}</p>`,
  };

  valiReq = await requestValispace(
    `rest/requirements/${req_identifier}/`,
    "PATCH",
    {},
    request_data
  );



  const component_vms_id = props.value.component_vms_id;

  if (change.toString in status_map) {
    await requestValispace(
      `rest/requirements/component-vms/${component_vms_id}/`,
      "PATCH",
      {},
      { status: status_map[change.toString] }
    );
  }
  else {
    console.log("Creating verification status...");
    let result = await createVerificationStatuses({ name: change.toString });
    const data = await result.json();

    console.log(JSON.stringify(data));

    await requestValispace(
      `rest/requirements/component-vms/${component_vms_id}/`,
      "PATCH",
      {},
      { status: data.id }
    );
  }
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
  const bodyData = `{
    "jql": "project=${project_key}",
    "maxResults": 8000,
    "fields": [
      "issue"
    ],
    "startAt": 0
  }`;

  let result = await api.asApp().requestJira(route`/rest/api/3/search`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: bodyData,
  });

  //   const jql = encodeURIComponent(
  //     `project=${project_name} and issue.property[valiReq] is not empty `
  //   );
  //   let result = await api
  //     .asApp()
  //     .requestJira(
  //       route`/rest/api/3/search?jql=${jql}&startAt=0&maxResults=8000&fields=issue`,
  //       {
  //         method: "GET",
  //         headers: {
  //           Accept: "application/json",
  //           "Content-Type": "application/json",
  //         },
  //       }
  //     );

  const data = await result.json();
  for (let issue of data.issues) {
    result = await getIssueValiReq(issue.key);
    const props = await result.json();
    const req_identifier = generateReqName(props);

    if (req_identifier != null) {
      req_mapping[req_identifier] = issue.key;
    }
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
      let updateObj = {};
      let id = cards_reqs_mapping[card_id];
      delete cards_reqs_mapping[card_id];   // remove card from list
      updateObj[id] = card_info;
      updateCards.push(updateObj);
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
    const bulk_create_format = {
      issueUpdates: newCards,
    };
    const result = await bulkCreateCards(bulk_create_format);
    console.log(
      `Created ${newCards.length} requirement${newCards.length > 1 ? "s" : ""}`,
      newCards
    );
  } else {
    console.log("No new requirements.");
  }

  // check for deleted cards
  const deletedReqCards = [];
  console.log("deleted cards:");
  for (let card_id in cards_reqs_mapping) {
    const card_req = cards_reqs_mapping[card_id];
    console.log("card_id", card_id);
    console.log("card_req", card_req);

    const result = await getIssue(card_req);
    const issue = await result.json();
    console.log("Issue:");
    console.log(JSON.stringify(issue, null, '\t'));

    deletedReqCards.push({
	    "key": card_req,
	    "fields": {
		    "status": {
			    "id": "10002"
        }
      }
    });

    const r1 = await removeIssueValiReq(card_req);
    const text = await r1.text();
    console.log(text);
  }

  if (deletedReqCards.length > 0) {
    const result = await bulkUpdateCards(deletedReqCards);
    console.log(
      `Updated ${deletedReqCards.length} requirement${
        deletedReqCards.length > 1 ? "s" : ""
      }`
    );
  } else {
    console.log("No requirements deleted.");
  }
};

const getIssueTypeID = async (name) => {
  let id = 0;
  const projectId = await storage.getSecret("jira_project_id");
  console.log(projectId);
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

const generateTaskData = (data, project_key, issueTypeId) => {
  // generate task data
  console.log(issueTypeId);
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
    },
    properties: [
      {
        key: "valiReq",
        value: {
          requirement_id: data.requirement["id"],
          verification_method_id: data.req_vm["id"],
          component_vms_id: data.cvm["id"],
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
