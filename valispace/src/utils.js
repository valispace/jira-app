import { DOMParser } from 'prosemirror-model';
import { JSONTransformer } from "@atlaskit/editor-json-transformer";
import { defaultSchema } from '@atlaskit/adf-schema/schema-default';
import { DOMImplementation } from '@xmldom/xmldom'

export class HtmlTransformer {
  constructor(schema) {
    this.schema = schema;
  }

  parse(html) {
    const dom = new DOMImplementation().createDocument();
    dom.innerHTML = html;
    return DOMParser.fromSchema(this.schema).parse(html);
  }
}

export const HtmlToADF = ( html ) => {
  console.log(html);
  const htmlTransformer = new HtmlTransformer(defaultSchema);
  const jsonTransformer = new JSONTransformer();
  const pmNode = htmlTransformer.parse(html)
  console.log(pmNode.toJSON());
  const adf = jsonTransformer.encode(pmNode);
  console.log(adf.content);
  return adf;
}
