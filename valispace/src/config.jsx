

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

const App = () => {
    const [linkedReq, setLinkedReq] = useState(0);


    const onButtonPress = async () => {
        /*
        const filter_data = await getFilteredRequirements();
        setLinkedReq(filter_data.length);
        // console.log(buildCardFromReq(filter_data[0]));
        await createCardsFromRequirements(filter_data);
        */

        const new_reqs = await getVerificationActivities(VALISPACE_PROJECT);

        const bulk_update_format = {
            "issueUpdates": new_reqs,
        };

        await bulkCreateCards(JSON.stringify(bulk_update_format));
    }



    return (
        <Fragment>
            <LinkedReqsText number={linkedReq} />
            <Button onClick={onButtonPress} text="Initial Valispace Sync xx"></Button>
        </Fragment>
    )
}

export const run = render(
    <ProjectPage>
        <App />
    </ProjectPage>
)
