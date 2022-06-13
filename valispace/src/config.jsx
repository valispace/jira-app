import ForgeUI,
{ render,
    useState,
    Button,
    ProjectPage,
    Fragment,
    Text,
    Form,
    Select,
    TextField } from '@forge/ui';
import api, { route, storage } from '@forge/api';
import { getVerificationActivities, requestValispace, updateOrCreateCards, valiReqIdentifier } from './valispace';


const LoginForm = ({ }) => {
    const getSavedValues = async (key) => {
        return await storage.getSecret(key)
    }
    const [valispace_url, setValispace_url] = useState(getSavedValues("valispace_url") || '');
    const [valispace_username, setValispace_username] =  useState(getSavedValues("valispace_username") || '');
    const [valispace_token, setValispace_token] =  useState(getSavedValues("valispace_token") || '');
    const [valispace_password, setValispace_password] =  useState(getSavedValues("valispace_password") || '');
    const [valispace_project, setValispace_project] = useState(getSavedValues("valispace_project") || '');
    const onSubmit = async (formData) => {
        for (const [key, value] of Object.entries(formData)) {
            storage.setSecret(key, value);
        }
        // console.log(getSavedValues('valispace_token'))
        setValispace_url(formData["valispace_url"]);
        setValispace_username(formData["valispace_username"]);
        setValispace_password(formData["valispace_password"]);
        setValispace_project(formData["valispace_project"]);

    }
    const goBack = () => {};
    const cancel = () => {};
    // The array of additional buttons.
    // These buttons align to the right of the submit button.
    const actionButtons = [
        <Button text="Go back" onClick={goBack} />,
        <Button text="Cancel" onClick={cancel} />,
    ];


    return (
        <Form onSubmit={onSubmit} actionButtons={actionButtons}>
            <TextField name="valispace_url" label="Valispace url" isRequired defaultValue={valispace_url}/>
            <TextField name="valispace_username" label="Username" isRequired defaultValue={valispace_username}/>
            {/* <TextField name="valispace_token" label="Token" isRequired defaultValue={valispace_token}/> */}
            <TextField name="valispace_password" label="Password" type="password" isRequired defaultValue={valispace_password}/>
            <TextField name="valispace_project" label="Project Id" type="number" isRequired defaultValue={valispace_project}/>
        </Form>
    )
}

const getIssueValiReq = async ( issue_key ) => {
    return api.asApp().requestJira(route`/rest/api/3/issue/${issue_key}/properties/valiReq`, {
        method: 'GET',
        headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
        }
    });
}


const App = () => {


    const updateClick = async () => { updateOrCreateCards()}

    // TODO: Disable button if not checkValispaceConnexion
    return (
        <Fragment>
            <LoginForm/>
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

    const changes = event.changelog.items;


    for (let change of changes) {


        if (change.fieldtype == 'jira') {
            if (change.field == 'status' || change.fieldId == 'status') {
                // console.log("New status...");

                let result = await getIssueValiReq(event.issue.key);
                const props = await result.json();
                const req_identifier = props.value.requirement_id;

                const request_data = {
                    'comment': `<p>${change.fromString} -> ${change.toString}</p>`,
                };

                console.log(`rest/requirements/${req_identifier}/`);
                result = await requestValispace(`rest/requirements/${req_identifier}/`, 'PATCH', {}, request_data);
                console.log(await result.text());
            } else if (change.field == 'resolution' || change.fieldId == 'resolution') {
                // console.log("New resolution...");
            } else if (change.field == 'description' || change.fieldId == 'description') {
                // console.log("New description...");
            } else if (change.field == 'summary' || change.fieldId == 'summary') {
                // console.log("New summary...");
            } else if (change.field == 'labels' || change.fieldId == 'labels') {
                // console.log("New labels...");
            } else {
                // console.log(`Unparsed change: ${change.field}, ${change.fieldId}`);
            }
        }
    }
}
