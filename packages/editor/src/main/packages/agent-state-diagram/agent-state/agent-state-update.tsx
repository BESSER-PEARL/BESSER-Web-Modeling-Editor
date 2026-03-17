import React, { Component, ComponentClass, createRef } from 'react';
import { connect } from 'react-redux';
import { compose } from 'redux';
import styled from 'styled-components';
import { Button } from '../../../components/controls/button/button';
import { ColorButton } from '../../../components/controls/color-button/color-button';
import { Divider } from '../../../components/controls/divider/divider';
import { TrashIcon } from '../../../components/controls/icon/trash';
import { Textfield } from '../../../components/controls/textfield/textfield';
import { Header } from '../../../components/controls/typography/typography';
import { I18nContext } from '../../../components/i18n/i18n-context';
import { localized } from '../../../components/i18n/localized';
import { ModelState } from '../../../components/store/model-state';
import { StylePane } from '../../../components/style-pane/style-pane';
import { UMLElement } from '../../../services/uml-element/uml-element';
import { UMLElementRepository } from '../../../services/uml-element/uml-element-repository';
import { AsyncDispatch } from '../../../utils/actions/actions';
import { notEmpty } from '../../../utils/not-empty';
import { AgentElementType } from '..';
import { AgentStateBody } from '../agent-state-body/agent-state-body';
import { AgentStateFallbackBody } from '../agent-state-fallback-body/agent-state-fallback-body';
import { UMLElementType } from '../../uml-element-type';
import { UMLElements } from '../../uml-elements';
import { AgentState } from './agent-state';
import BotBodyUpdate from '../agent-state-body/agent-state-body-update';
import { AgentStateMember } from '../agent-state/agent-state-member';
// import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
// import { dark } from 'react-syntax-highlighter/dist/esm/styles/prism';

import { Controlled as CodeMirror } from 'react-codemirror2';
import 'codemirror/lib/codemirror.css';
import 'codemirror/theme/material.css';
import 'codemirror/mode/python/python';
import { Dropdown } from '../../../components/controls/dropdown/dropdown';
import { LayouterRepository } from '../../../services/layouter/layouter-repository';


const Flex = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
`;

const StyledTextArea = styled.textarea`
  padding: 8px;
  border: 1px solid ${(props) => props.theme.color.gray};
  border-radius: 4px;
  width: 100%;
  min-height: 150px;
  font-family: monospace;
  white-space: pre;
  tab-size: 4;
  box-sizing: border-box;
  overflow-x: auto;
  
  &:focus {
    outline: none;
    border-color: ${(props) => props.theme.color.primary};
  }
`;

const ResizableCodeMirrorWrapper = styled.div`
  resize: both;
  overflow: auto; /* Ensure content doesn't overflow */
  min-height: 150px; /* Set a minimum height */
  border: 1px solid ${(props) => props.theme.color.gray};
  border-radius: 4px;
  padding: 8px;
  box-sizing: border-box;

  .CodeMirror {
    height: 100% !important; /* Ensure CodeMirror fills the wrapper */
    width: 100%;
  }
`;

interface OwnProps {
  element: AgentState;
}

type StateProps = {
  elements: ModelState['elements'];
};

interface DispatchProps {
  create: typeof UMLElementRepository.create;
  update: typeof UMLElementRepository.update;
  remove: typeof UMLElementRepository.delete; // Renamed to avoid conflict with reserved keywords
  getById: (id: string) => UMLElement | null;
  layout: typeof LayouterRepository.layout;
}

type Props = OwnProps & StateProps & DispatchProps & I18nContext;

type DbReplyValues = {
  dbSelectionType: string;
  dbCustomName: string;
  dbQueryMode: string;
  dbOperation: string;
  dbSqlQuery: string;
};

interface State {
  colorOpen: boolean;
  fieldToFocus?: Textfield<string> | null;
}

const getInitialState = (): State => ({
  colorOpen: false,
});

const enhance = compose<ComponentClass<OwnProps>>(
  localized,
  connect<StateProps, DispatchProps, OwnProps, ModelState>(
    (state) => ({ elements: state.elements }),
    {
      create: UMLElementRepository.create,
      update: UMLElementRepository.update,
      remove: UMLElementRepository.delete, // Updated to match the renamed property
      getById: UMLElementRepository.getById as any as AsyncDispatch<typeof UMLElementRepository.getById>,
      layout: LayouterRepository.layout,
    },
  ),
);

class StateUpdate extends Component<Props, State> {
  state = getInitialState();
  newFallbackBodyField = createRef<Textfield<string>>();
  newBodyField = createRef<Textfield<string>>();
  private actionTypeRef = createRef<HTMLInputElement>();
  bodyReplyType = "text";
  fallbackBodyReplyType = "text";
  private layoutTimer: ReturnType<typeof setTimeout> | null = null;

  componentWillUnmount() {
    if (this.layoutTimer) {
      clearTimeout(this.layoutTimer);
    }
  }

  private scheduleLayout = () => {
    if (this.layoutTimer) {
      clearTimeout(this.layoutTimer);
    }
    this.layoutTimer = setTimeout(() => {
      this.props.layout();
      this.layoutTimer = null;
    }, 300);
  };

  private toggleColor = () => {
    this.setState((state) => ({
      colorOpen: !state.colorOpen,
    }));
  };

  componentDidUpdate(prevProps: Readonly<Props>, prevState: Readonly<{}>, snapshot?: any) {
    if (this.state.fieldToFocus) {
      this.state.fieldToFocus.focus();
      this.setState({ fieldToFocus: undefined });
    }
  }


  private handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>, bodyId: string) => {
    // Allow tab key to insert a tab character instead of changing focus
    if (event.key === 'Tab') {
      event.preventDefault();

      const target = event.target as HTMLTextAreaElement;
      const start = target.selectionStart;
      const end = target.selectionEnd;

      const value = target.value;
      const newValue = value.substring(0, start) + '\t' + value.substring(end);

      // Update the value directly in the textarea
      target.value = newValue;

      // Update the cursor position
      setTimeout(() => {
        target.selectionStart = target.selectionEnd = start + 1;
      }, 0);

      // Propagate the change to the backend
      this.props.update(bodyId, { name: newValue });
    }
  };



  render() {
    const { element, getById, elements } = this.props;
    const children = element.ownedElements.map((id) => getById(id)).filter(notEmpty);
    const bodies = children.filter(
      (child): child is AgentStateMember => child instanceof AgentStateBody
    );
    const ragDatabaseNames = Array.from(
      new Set(
        Object.values(elements)
          .filter((el: any) => el.type === AgentElementType.AgentRagElement && typeof el.name === 'string')
          .map((el: any) => el.name.trim())
          .filter((name) => name.length > 0),
      ),
    );
    const ragBody = bodies.find((body) => body.replyType === 'rag');
    const dbBody = bodies.find((body) => body.replyType === 'db_reply');
    const preserveTabs = (str: string): string => {
      return str.replace(/\t/g, '    ');
    };

    this.bodyReplyType = 'text';
    if (bodies.some((body) => body.replyType === 'rag')) {
      this.bodyReplyType = 'rag';
    } else if (bodies.some((body) => body.replyType === 'db_reply')) {
      this.bodyReplyType = 'db_reply';
    } else if (bodies.some((body) => body.replyType === 'llm')) {
      this.bodyReplyType = 'llm';
    } else if (bodies.some((body) => body.replyType === 'code')) {
      this.bodyReplyType = 'code';
    }

    const fallbackBodies = children.filter(
      (child): child is AgentStateMember => child instanceof AgentStateFallbackBody
    );
    const fallbackRagBody = fallbackBodies.find((fallbackBody) => fallbackBody.replyType === 'rag');
    const fallbackDbBody = fallbackBodies.find((fallbackBody) => fallbackBody.replyType === 'db_reply');

    fallbackBodies.forEach((fallbackBody) => {
      if (fallbackBody.replyType === "rag") {
        this.fallbackBodyReplyType = "rag"
      } else if (fallbackBody.replyType === "db_reply") {
        this.fallbackBodyReplyType = "db_reply"
      } else if (fallbackBody.replyType === "llm") {
        this.fallbackBodyReplyType = "llm"
      } else if (fallbackBody.replyType === "code") {
        this.fallbackBodyReplyType = "code"
      } else {
        this.fallbackBodyReplyType = "text"
      }
    });
    const bodyRefs: (Textfield<string> | null)[] = [];
    const fallbackBodyRefs: (Textfield<string> | null)[] = [];

    return (
      <div>
        <section>
          <Flex>
            <Textfield value={element.name} onChange={this.rename(element.id)} autoFocus />
            <ColorButton onClick={this.toggleColor} />
            <Button color="link" tabIndex={-1} onClick={this.delete(element.id)}>
              <TrashIcon />
            </Button>
          </Flex>
          <StylePane
            open={this.state.colorOpen}
            element={element}
            onColorChange={this.props.update}
            fillColor
            lineColor
            textColor
          />
          <Divider />
        </section>
        <section>
          Agent Action
          <div>
            <label>
              <input
                type="radio"
                name="actionType"
                value="textReply"
                defaultChecked={this.bodyReplyType === "text"}
                onChange={() => {
                  this.bodyReplyType = "text";
                  {
                    bodies.forEach((body) => {
                      if (body.replyType === "llm" || body.replyType === "code" || body.replyType === "rag" || body.replyType === "db_reply") {
                        this.delete(body.id)();
                      }
                    })
                  }
                  this.forceUpdate();
                }}
              />
              Text Reply
            </label>

            <label>
              <input
                type="radio"
                name="actionType"
                value="LLM"
                defaultChecked={this.bodyReplyType === "llm"}
                onChange={() => {

                  this.bodyReplyType = "llm"
                  {
                    bodies.forEach((body) => {
                      if (body.replyType === "code" || body.replyType === "text" || body.replyType === "rag" || body.replyType === "db_reply") {
                        this.delete(body.id)();
                      }
                    })
                  }
                  this.create(AgentStateBody, "llm")("AI response 🪄")
                  this.forceUpdate()
                }}
              />
              LLM automatic reply
            </label>
            <label>
              <input
                type="radio"
                name="actionType"
                value="rag"
                defaultChecked={this.bodyReplyType === "rag"}
                onChange={() => {
                  this.bodyReplyType = "rag";
                  bodies.forEach((body) => {
                    if (body.replyType !== "rag") {
                      this.delete(body.id)();
                    }
                  });
                  if (!bodies.some((body) => body.replyType === "rag")) {
                    const defaultName = this.getRagDisplayName('');
                    this.create(AgentStateBody, "rag", { ragDatabaseName: '', name: defaultName })(defaultName);
                  }
                  this.forceUpdate();
                }}
              />
              RAG reply
            </label>
            <label>
              <input
                type="radio"
                name="actionType"
                value="dbReply"
                defaultChecked={this.bodyReplyType === "db_reply"}
                onChange={() => {
                  this.bodyReplyType = "db_reply";
                  bodies.forEach((body) => {
                    if (body.replyType !== "db_reply") {
                      this.delete(body.id)();
                    }
                  });
                  if (!bodies.some((body) => body.replyType === "db_reply")) {
                    const defaultDbReplyValues = this.getDefaultDbReplyValues();
                    this.create(AgentStateBody, "db_reply", defaultDbReplyValues)(
                      this.getDbDisplayName(
                        defaultDbReplyValues.dbSelectionType ?? 'default',
                        defaultDbReplyValues.dbCustomName ?? '',
                        defaultDbReplyValues.dbQueryMode ?? 'llm_query',
                        defaultDbReplyValues.dbOperation ?? 'any',
                      ),
                    );
                  }
                  this.forceUpdate();
                }}
              />
              DB action
            </label>
            <label>
              <input
                type="radio"
                name="actionType"
                value="pythonCode"
                defaultChecked={this.bodyReplyType === "code"}
                onChange={() => {
                  this.bodyReplyType = "code"
                  {
                    bodies.forEach((body) => {
                      if (body.replyType === "llm" || body.replyType === "text" || body.replyType === "rag" || body.replyType === "db_reply") {
                        this.delete(body.id)();
                      }
                    })
                  }
                  this.create(AgentStateBody, "code")("def action_name(session: AgentSession):\n\n\n\n\n")
                  this.forceUpdate()
                }}
              />
              Python Code
            </label>
          </div>

          {/* Conditionally render based on the selected radio button */}
          {this.bodyReplyType === "text" ? (
            <>
              {bodies
                .filter((body) => body.replyType === "text")
                .map((body, index) => (
                  <BotBodyUpdate
                    id={body.id}
                    key={body.id}
                    value={body.name}
                    onChange={this.props.update}
                    onSubmitKeyUp={() =>
                      index === bodies.length - 1
                        ? this.newBodyField.current?.focus()
                        : this.setState({
                          fieldToFocus: bodyRefs[index + 1],
                        })
                    }
                    onDelete={this.delete}
                    onRefChange={(ref) => (bodyRefs[index] = ref)}
                    element={body}
                  />
                ))}

              <Textfield
                ref={this.newBodyField}
                outline
                value=""
                onSubmit={this.create(AgentStateBody, "text")}
                onSubmitKeyUp={(key: string, value: string) => {
                  if (value) {
                    this.setState({
                      fieldToFocus: this.newBodyField.current,
                    });
                  } else {
                    if (fallbackBodyRefs && fallbackBodyRefs.length > 0) {
                      this.setState({
                        fieldToFocus: fallbackBodyRefs[0],
                      });
                    } else {
                      this.setState({
                        fieldToFocus: this.newFallbackBodyField.current,
                      });
                    }
                  }
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Tab' && event.currentTarget.value) {
                    event.preventDefault();
                    event.currentTarget.blur();
                    this.setState({
                      fieldToFocus: this.newBodyField.current,
                    });
                  }
                }}
              />
            </>
          ) : this.bodyReplyType === "code" ? (
            <>

              <ResizableCodeMirrorWrapper>
                <CodeMirror
                  value={bodies.find((body) => body.replyType === "code")!.name}
                  options={{
                    mode: 'python',
                    theme: 'material',
                    lineNumbers: true,
                    tabSize: 4,
                    indentWithTabs: true,
                  }}
                  onBeforeChange={(editor, data, value) => {
                    const body = bodies.find((body) => body.replyType === "code")!;
                    this.props.update(body.id, { name: value });
                    this.scheduleLayout();
                  }}
                  onChange={(editor, data, value) => {
                    const body = bodies.find((body) => body.replyType === "code")!;
                    if (value.trim()) {
                      this.props.update(body.id, { name: value });
                    }
                  }}
                />
              </ResizableCodeMirrorWrapper>

            </>
          ) : this.bodyReplyType === "rag" ? (
            ragDatabaseNames.length ? (
              <Dropdown
                value={ragBody?.ragDatabaseName && ragBody.ragDatabaseName.length > 0 ? ragBody.ragDatabaseName : '__placeholder__'}
                onChange={(value) => {
                  const selected = value === '__placeholder__' ? '' : value;
                  const displayName = this.getRagDisplayName(selected);
                  if (ragBody) {
                    this.props.update<AgentStateMember>(ragBody.id, { ragDatabaseName: selected, name: displayName });
                  } else {
                    this.create(AgentStateBody, 'rag', { ragDatabaseName: selected, name: displayName })(displayName);
                  }
                }}
              >
                {[
                  <Dropdown.Item value="__placeholder__" key="rag-placeholder">
                    Select RAG database
                  </Dropdown.Item>,
                  ...ragDatabaseNames.map((name, index) => (
                    <Dropdown.Item key={`rag-${index}-${name}`} value={name}>
                      {name}
                    </Dropdown.Item>
                  )),
                ]}
              </Dropdown>
            ) : (
              <p>No RAG databases available. Create one from the palette first.</p>
            )
          ) : this.bodyReplyType === "db_reply" ? (
            this.renderDbReplyEditor(dbBody, AgentStateBody)
          ) : (
            <>
              <>
                <p>An automated response will be generated.</p>
              </>
            </>
          )}
        </section>
        <section>
          <Divider />

        </section>
        <section>
          Agent Fallback Action
          <div>
            <label>
              <input
                type="radio"
                name="fallbackActionType"
                value="textReply"
                defaultChecked={this.fallbackBodyReplyType === "text"}
                onChange={() => {
                  this.fallbackBodyReplyType = "text"
                  {
                    fallbackBodies.forEach((fallbackBody) => {
                      if (fallbackBody.replyType === "llm" || fallbackBody.replyType === "rag" || fallbackBody.replyType === "code" || fallbackBody.replyType === "db_reply") {
                        this.delete(fallbackBody.id)();
                      }
                    })
                  }
                  this.forceUpdate()
                }}
              />
              Text Reply
            </label>

            <label>
              <input
                type="radio"
                name="fallbackActionType"
                value="pythonCode"
                defaultChecked={this.fallbackBodyReplyType === "llm"}
                onChange={() => {
                  this.fallbackBodyReplyType = "llm"
                  {
                    fallbackBodies.forEach((body) => {
                      if (body.replyType === "code" || body.replyType === "text" || body.replyType === "rag" || body.replyType === "db_reply") {
                        this.delete(body.id)();
                      }
                    })
                  }
                  this.create(AgentStateFallbackBody, "llm")("AI response 🪄")
                  this.forceUpdate()
                }}
              />
              LLM automatic reply
            </label>
            <label>
              <input
                type="radio"
                name="fallbackActionType"
                value="rag"
                defaultChecked={this.fallbackBodyReplyType === "rag"}
                onChange={() => {
                  this.fallbackBodyReplyType = "rag";
                  fallbackBodies.forEach((fallbackBody) => {
                    if (fallbackBody.replyType !== "rag") {
                      this.delete(fallbackBody.id)();
                    }
                  });
                  if (!fallbackBodies.some((body) => body.replyType === "rag")) {
                    const defaultName = this.getRagDisplayName('');
                    this.create(AgentStateFallbackBody, "rag", { ragDatabaseName: '', name: defaultName })(defaultName);
                  }
                  this.forceUpdate();
                }}
              />
              RAG reply
            </label>
            <label>
              <input
                type="radio"
                name="fallbackActionType"
                value="dbReply"
                defaultChecked={this.fallbackBodyReplyType === "db_reply"}
                onChange={() => {
                  this.fallbackBodyReplyType = "db_reply";
                  fallbackBodies.forEach((fallbackBody) => {
                    if (fallbackBody.replyType !== "db_reply") {
                      this.delete(fallbackBody.id)();
                    }
                  });
                  if (!fallbackBodies.some((body) => body.replyType === "db_reply")) {
                    const defaultDbReplyValues = this.getDefaultDbReplyValues();
                    this.create(AgentStateFallbackBody, "db_reply", defaultDbReplyValues)(
                      this.getDbDisplayName(
                        defaultDbReplyValues.dbSelectionType ?? 'default',
                        defaultDbReplyValues.dbCustomName ?? '',
                        defaultDbReplyValues.dbQueryMode ?? 'llm_query',
                        defaultDbReplyValues.dbOperation ?? 'any',
                      ),
                    );
                  }
                  this.forceUpdate();
                }}
              />
              DB action
            </label>
            <label>
              <input
                type="radio"
                name="fallbackActionType"
                value="pythonCode"
                defaultChecked={this.fallbackBodyReplyType === "code"}
                onChange={() => {
                  this.fallbackBodyReplyType = "code"
                  {
                    fallbackBodies.forEach((fallbackBody) => {
                      if (fallbackBody.replyType === "llm" || fallbackBody.replyType === "text" || fallbackBody.replyType === "rag" || fallbackBody.replyType === "db_reply") {
                        this.delete(fallbackBody.id)();
                      }
                    })
                  }
                  this.create(AgentStateFallbackBody, "code")("def action_name(session: AgentSession):\n")
                  this.forceUpdate()
                }}
              />
              Python Code
            </label>
          </div>

          {/* Conditionally render based on the selected radio button */}
          {this.fallbackBodyReplyType === "text" ? (
            <>
              {fallbackBodies
                .filter((fallbackBody) => fallbackBody.replyType === "text")
                .map((fallbackBody, index) => (
                  <BotBodyUpdate
                    id={fallbackBody.id}
                    key={fallbackBody.id}
                    value={fallbackBody.name}
                    onChange={this.props.update}
                    onSubmitKeyUp={() =>
                      index === fallbackBodies.length - 1
                        ? this.newFallbackBodyField.current?.focus()
                        : this.setState({
                          fieldToFocus: fallbackBodyRefs[index + 1],
                        })
                    }
                    onDelete={this.delete}
                    onRefChange={(ref) => (fallbackBodyRefs[index] = ref)}
                    element={fallbackBody}
                  />
                ))}
              <Textfield
                ref={this.newFallbackBodyField}
                outline
                value=""
                onSubmit={this.create(AgentStateFallbackBody, "text")}
                onSubmitKeyUp={() =>
                  this.setState({
                    fieldToFocus: this.newFallbackBodyField.current,
                  })
                }
                onKeyDown={(event) => {
                  if (event.key === 'Tab' && event.currentTarget.value) {
                    event.preventDefault();
                    event.currentTarget.blur();
                    this.setState({
                      fieldToFocus: this.newFallbackBodyField.current,
                    });
                  }
                }}
              />
            </>
          ) : this.fallbackBodyReplyType === "code" ? (
            <>

              <ResizableCodeMirrorWrapper>
                <CodeMirror
                  value={fallbackBodies.find((fallbackBody) => fallbackBody.replyType === "code")!.name}
                  options={{
                    mode: 'python',
                    theme: 'material',
                    lineNumbers: true,
                    tabSize: 4,
                    indentWithTabs: true,
                  }}
                  onBeforeChange={(editor, data, value) => {
                    const fallbackBody = fallbackBodies.find((fallbackBody) => fallbackBody.replyType === "code")!;
                    this.props.update(fallbackBody.id, { name: value });
                    this.scheduleLayout();
                  }}
                  onChange={(editor, data, value) => {
                    const fallbackBody = fallbackBodies.find((fallbackBody) => fallbackBody.replyType === "code")!;
                    if (value.trim()) {
                      this.props.update(fallbackBody.id, { name: value });
                    }
                  }}
                />
              </ResizableCodeMirrorWrapper>

            </>
          ) : this.fallbackBodyReplyType === "rag" ? (
            ragDatabaseNames.length ? (
              <Dropdown
                value={fallbackRagBody?.ragDatabaseName || '__placeholder__'}
                onChange={(value) => {
                  const selected = value === '__placeholder__' ? '' : value;
                  const displayName = this.getRagDisplayName(selected);
                  if (fallbackRagBody) {
                    this.props.update<AgentStateMember>(fallbackRagBody.id, { ragDatabaseName: selected, name: displayName });
                  } else {
                    this.create(AgentStateFallbackBody, 'rag', { ragDatabaseName: selected, name: displayName })(displayName);
                  }
                }}
              >
                {[
                  <Dropdown.Item value="__placeholder__" key="fallback-rag-placeholder">
                    Select RAG database
                  </Dropdown.Item>,
                  ...ragDatabaseNames.map((name, index) => (
                    <Dropdown.Item key={`fallback-rag-${index}-${name}`} value={name}>
                      {name}
                    </Dropdown.Item>
                  )),
                ]}
              </Dropdown>
            ) : (
              <p>No RAG databases available. Create one from the palette first.</p>
            )
          ) : this.fallbackBodyReplyType === "db_reply" ? (
            this.renderDbReplyEditor(fallbackDbBody, AgentStateFallbackBody)
          ) : (<></>)}

        </section>
      </div>
    );
  }

  private getRagDisplayName = (databaseName: string): string => {
    const trimmed = (databaseName || '').trim();
    return trimmed.length ? `RAG reply using ${trimmed} database` : 'RAG reply (select database)';
  };

  private getDefaultDbReplyValues = (): DbReplyValues => ({
    dbSelectionType: 'default',
    dbCustomName: '',
    dbQueryMode: 'llm_query',
    dbOperation: 'any',
    dbSqlQuery: '',
  });

  private getDbDisplayName = (
    dbSelectionType: string,
    dbCustomName: string,
    dbQueryMode: string,
    dbOperation: string,
  ): string => {
    const customDatabaseName = (dbCustomName || '').trim();
    const databaseLabel = dbSelectionType === 'custom'
      ? (customDatabaseName.length ? customDatabaseName : 'custom database')
      : 'Default database';
    const modeLabel = dbQueryMode === 'sql' ? 'SQL' : 'LLM query';
    const operationLabel = dbOperation === 'any' ? 'Any' : dbOperation.toUpperCase();

    return `DB action using ${databaseLabel} (${modeLabel}, ${operationLabel})`;
  };

  private updateDbReply = (member: AgentStateMember, values: Partial<AgentStateMember>) => {
    const dbSelectionType = values.dbSelectionType ?? member.dbSelectionType ?? 'default';
    const dbCustomName = values.dbCustomName ?? member.dbCustomName ?? '';
    const dbQueryMode = values.dbQueryMode ?? member.dbQueryMode ?? 'llm_query';
    const dbOperation = values.dbOperation ?? member.dbOperation ?? 'any';

    this.props.update<AgentStateMember>(member.id, {
      ...values,
      name: this.getDbDisplayName(dbSelectionType, dbCustomName, dbQueryMode, dbOperation),
    });
  };

  private renderDbReplyEditor = (
    member: AgentStateMember | undefined,
    Clazz: typeof AgentStateBody | typeof AgentStateFallbackBody,
  ) => {
    if (!member) {
      const handleInitializeDbReply = () => {
        const defaultDbReplyValues = this.getDefaultDbReplyValues();
        const displayName = this.getDbDisplayName(
          defaultDbReplyValues.dbSelectionType ?? 'default',
          defaultDbReplyValues.dbCustomName ?? '',
          defaultDbReplyValues.dbQueryMode ?? 'llm_query',
          defaultDbReplyValues.dbOperation ?? 'any',
        );
        this.create(Clazz, 'db_reply', defaultDbReplyValues)(displayName);
      };

      return (
        <>
          <p>Configuring database action...</p>
          <Button color="primary" onClick={handleInitializeDbReply}>
            Initialize database action
          </Button>
        </>
      );
    }

    const dbSelectionType = member.dbSelectionType || 'default';
    const dbQueryMode = member.dbQueryMode || 'llm_query';
    const dbOperation = member.dbOperation || 'any';

    return (
      <>
        <p>Select a Database</p>
        <Dropdown
          value={dbSelectionType}
          onChange={(value) => {
            const nextSelectionType = value === 'custom' ? 'custom' : 'default';
            this.updateDbReply(member, {
              dbSelectionType: nextSelectionType,
              dbCustomName: nextSelectionType === 'default' ? '' : member.dbCustomName,
            });
          }}
        >
          {[
            <Dropdown.Item value="default" key="db-default">
              Default (using the app DB)
            </Dropdown.Item>,
            <Dropdown.Item value="custom" key="db-custom">
              Custom
            </Dropdown.Item>,
          ]}
        </Dropdown>

        {dbSelectionType === 'custom' ? (
          <Textfield
            outline
            placeholder="Custom database name"
            value={member.dbCustomName || ''}
            onChange={(value) => this.updateDbReply(member, { dbCustomName: value })}
          />
        ) : null}

        <div>
          <label>DB operation</label>
          <Dropdown
            value={dbOperation}
            onChange={(value) => {
              const allowedOperations = ['any', 'select', 'insert', 'update', 'delete'];
              const nextOperation = allowedOperations.includes(value) ? value : 'any';
              this.updateDbReply(member, { dbOperation: nextOperation });
            }}
          >
            {[
              <Dropdown.Item value="any" key="db-operation-any">
                Any
              </Dropdown.Item>,
              <Dropdown.Item value="select" key="db-operation-select">
                SELECT
              </Dropdown.Item>,
              <Dropdown.Item value="insert" key="db-operation-insert">
                INSERT
              </Dropdown.Item>,
              <Dropdown.Item value="update" key="db-operation-update">
                UPDATE
              </Dropdown.Item>,
              <Dropdown.Item value="delete" key="db-operation-delete">
                DELETE
              </Dropdown.Item>,
            ]}
          </Dropdown>
        </div>

        <div>
          <label>
            <input
              type="radio"
              name={`dbQueryMode-${member.id}`}
              value="llm_query"
              checked={dbQueryMode === 'llm_query'}
              onChange={() => this.updateDbReply(member, { dbQueryMode: 'llm_query', dbSqlQuery: '' })}
            />
            LLM query
          </label>

          <label>
            <input
              type="radio"
              name={`dbQueryMode-${member.id}`}
              value="sql"
              checked={dbQueryMode === 'sql'}
              onChange={() => this.updateDbReply(member, { dbQueryMode: 'sql' })}
            />
            SQL
          </label>
        </div>

        {dbQueryMode === 'sql' ? (
          <Textfield
            outline
            multiline
            enterToSubmit={false}
            placeholder="SELECT * FROM table_name"
            value={member.dbSqlQuery || ''}
            onChange={(value) => this.updateDbReply(member, { dbSqlQuery: value })}
          />
        ) : (
          <p>Answer will be generated with LLM during runtime</p>
        )}
      </>
    );
  };

  private create = (
    Clazz: typeof AgentStateBody | typeof AgentStateFallbackBody,
    replyType: string,
    initialValues?: Partial<AgentStateMember>,
  ) => (value: string) => {
    const { element, create } = this.props;
    const member = new Clazz();
    member.name = value;
    member.replyType = replyType;
    if (initialValues) {
      Object.assign(member, initialValues);
    }
    create(member, element.id);
  };

  private rename = (id: string) => (value: string) => {
    this.props.update(id, { name: value });
  };

  private delete = (id: string) => () => {
    this.props.remove(id); // Updated to use the renamed method
  };
}

export const AgentStateUpdate = enhance(StateUpdate);