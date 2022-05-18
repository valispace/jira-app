import ForgeUI, { render, Fragment, Text, IssuePanel, useProductContext, useState } from '@forge/ui';
import api, { route } from "@forge/api";


const App = () => {

  


  return (
    <Fragment>
      <Text>Hello world!</Text>
    </Fragment>
  );
};


export const run = render(
  <IssuePanel>
    <App />
  </IssuePanel>
);
