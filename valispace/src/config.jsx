

import ForgeUI, { render, useState, Button, ProjectPage, Fragment, Text } from '@forge/ui';
import api, { route, storage, fetch } from '@forge/api';
import { getFilteredRequirement, getVerificationActivities } from './valispace';
import { HtmlToADF } from './utils';
import { VALISPACE_PROJECT } from './constants';


const LinkedReqsText = ( {number} ) => {
    if (number > 0) {
        return <Text>{number} requirement{number > 1 ? 's' :''} synced</Text>;
    }
    return false;
}

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

const getValiReqMapping = async (project_name) => {
    const req_mapping = {};

    let result = await api.asApp().requestJira(route`/rest/api/3/search?jql=project=${project_name} and issue.property[valiReq].identifier is not empty &startAt=0&maxResults=8000&fields=issue`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
    });

    const data = await result.json();

    for (let issue of data.issues) {
        console.log(`Issue: ${issue.key}`);

        result = await api.asApp().requestJira(route`/rest/api/3/issue/${issue.key}/properties/valiReq`, {
            method: 'GET',
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json'
            }
        });

        const props = await result.json();

        const req_identifier = props.value.identifier;

        console.log(req_identifier);

        req_mapping[req_identifier] = issue.key;
    }

    return req_mapping;
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


    const initialSyncClick = async () => {
        /*
        const filter_data = await getFilteredRequirements();
        setLinkedReq(filter_data.length);
        // console.log(buildCardFromReq(filter_data[0]));
        await createCardsFromRequirements(filter_data);
        */

        const new_reqs = await getVerificationActivities();

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


    const updateClick = async () => {
        const req_mapping = await getValiReqMapping('VTS');

        console.log(JSON.stringify(req_mapping, null, '\t'));
    }


    return (
        <Fragment>
            <LinkedReqsText number={linkedReq} />
            <Button onClick={initialSyncClick} text="Initial Valispace Sync"></Button>
            <Button onClick={updateClick} text="Update from Valispace"></Button>
        </Fragment>
    )
}

export const run = render(
    <ProjectPage>
        <App />
    </ProjectPage>
)
