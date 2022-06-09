import ForgeUI, { render, useState, Button, ProjectPage, Fragment, Text } from '@forge/ui';
import api, { route } from '@forge/api';
import { getVerificationActivities, requestValispace, valiReqIdentifier } from './valispace';


const LinkedReqsText = ( {number} ) => {
    if (number > 0) {
        return <Text>{number} requirement{number > 1 ? 's' :''} synced</Text>;
    }
    return false;
}

/*
const buildCardFromReq = ( data ) => {
    return {
        "fields": {
            "summary": data.identifier,
            "project": {
                "key": "VTS2"
            },
            "issuetype": {
                "id": "10005"
            },
        },
        "properties": [
            {
                "key" : "valiReq" ,
                "value": `${data.id}`
            }
        ]
    };

}
*/

const getIssueValiReq = async ( issue_key ) => {
    return api.asApp().requestJira(route`/rest/api/3/issue/${issue_key}/properties/valiReq`, {
        method: 'GET',
        headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
        }
    });
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

    for (let issue of data.issues) {
        // console.log(`Issue: ${issue.key}`);

        result = await getIssueValiReq(issue.key);
        const props = await result.json();
        const req_identifier = valiReqIdentifier(props);

        // console.log(req_identifier);

        if (req_identifier != null) {
            req_mapping[req_identifier] = issue.key;
        }
    }

    return req_mapping;
}

/*
const createCardsFromRequirements = async ( reqs ) => {
    let newCards = [];
    reqs.forEach(( req ) => {
        newCards.push(buildCardFromReq(req));
    });
    const bulkUpdateFormat = {
        "issueUpdates": newCards
    }
    console.log(bulkUpdateFormat);
    console.log(await (await bulkCreateCards(JSON.stringify(bulkUpdateFormat))).text());
}
*/

const App = () => {
    const [linkedReq, setLinkedReq] = useState(0);

    /*
    const initialSyncClick = async () => {
        let new_reqs = await getVerificationActivities();
        new_reqs = Object.values(new_reqs);

        console.log("new_reqs", new_reqs);

        if (new_reqs.length > 0) {
            const bulk_update_format = {
                "issueUpdates": new_reqs,
            };

            console.log(JSON.stringify(bulk_update_format));

            const result = await bulkCreateCards(JSON.stringify(bulk_update_format));
            console.log(await result.text());
        }
        else {
            console.log("No new requirements.");
        }
    }
    */

    const updateClick = async () => {
        const req_mapping = await getValiReqMapping('VTS');
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

                /*let result = await api.asApp().requestJira(route`/rest/api/3/issue/${req_mapping[identifier]}`, {
                    method: 'GET',
                    headers: {
                      'Accept': 'application/json',
                      'Content-Type': 'application/json'
                    }
                });

                console.log(await result.text());*/

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


    return (
        <Fragment>
            <LinkedReqsText number={linkedReq} />
            <Button onClick={updateClick} text="Update from Valispace"></Button>
        </Fragment>
    )
}

export const run = render(
    <ProjectPage>
        <App />
    </ProjectPage>
)

export async function issueUpdate(event, context) {
	console.log('issueUpdate');
    // console.log('event:');
    // console.log(JSON.stringify(event, null, '\t'));
    // console.log('context:');
    // console.log(JSON.stringify(context, null, '\t'));

    const changes = event.changelog.items;

    for (let change of changes) {
        console.log(change);

        if (change.fieldtype == 'jira') {
            'resolution'
            if (change.field == 'status' || change.fieldId == 'status') {
                console.log("New status...");

                let result = await getIssueValiReq(event.issue.key);
                const props = await result.json();
                const req_identifier = props.value.identifier;

                const request_data = {
                    'comment': `$(change.fromString) -> $(change.toString)`,
                };

                result = await requestValispace(`rest/requirements/${req_identifier}/`, 'PATCH', {}, request_data);
                console.log(result.text());
            } else if (change.field == 'resolution' || change.fieldId == 'resolution') {
                console.log("New resolution...");
            } else if (change.field == 'description' || change.fieldId == 'description') {
                console.log("New description...");
            } else if (change.field == 'summary' || change.fieldId == 'summary') {
                console.log("New summary...");
            } else if (change.field == 'labels' || change.fieldId == 'labels') {
                console.log("New labels...");
            } else {
                console.log(`Unparsed change: ${change.field}, ${change.fieldId}`);
            }
        }
    }
}
