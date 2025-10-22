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

type StateProps = {};

interface DispatchProps {
  create: typeof UMLElementRepository.create;
  update: typeof UMLElementRepository.update;
  remove: typeof UMLElementRepository.delete; // Renamed to avoid conflict with reserved keywords
  getById: (id: string) => UMLElement | null;
}

type Props = OwnProps & StateProps & DispatchProps & I18nContext;

interface State {
  colorOpen: boolean;
  fieldToFocus?: Textfield<string> | null;
}

const getInitialState = (): State => ({
  colorOpen: false,
});

const enhance = compose<ComponentClass<OwnProps>>(
  localized,
  connect<StateProps, DispatchProps, OwnProps, ModelState>(null, {
    create: UMLElementRepository.create,
    update: UMLElementRepository.update,
    remove: UMLElementRepository.delete, // Updated to match the renamed property
    getById: UMLElementRepository.getById as any as AsyncDispatch<typeof UMLElementRepository.getById>,
  }),
);

class StateUpdate extends Component<Props, State> {
  state = getInitialState();
  newFallbackBodyField = createRef<Textfield<string>>();
  newBodyField = createRef<Textfield<string>>();
  private actionTypeRef = createRef<HTMLInputElement>();
  bodyReplyType = "text";
  fallbackBodyReplyType = "text";
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
    const { element, getById } = this.props;
    const children = element.ownedElements.map((id) => getById(id)).filter(notEmpty);
    const bodies = children.filter(
      (child): child is AgentStateMember => child instanceof AgentStateBody
    );
    const preserveTabs = (str: string): string => {
      return str.replace(/\t/g, '    ');
    };

    bodies.forEach((body) => {
      if (body.replyType === "llm") {
        this.bodyReplyType = "llm"
      } else if (body.replyType === "code") {
        this.bodyReplyType = "code"
      } else {
        this.bodyReplyType = "text"
      }
    });

    const fallbackBodies = children.filter(
      (child): child is AgentStateMember => child instanceof AgentStateFallbackBody
    );

    fallbackBodies.forEach((fallbackBody) => {
      if (fallbackBody.replyType === "llm") {
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
          Bot Action
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
                      if (body.replyType === "llm" || body.replyType === "code") {
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
                      if (body.replyType === "code" || body.replyType === "text") {
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
                value="pythonCode"
                defaultChecked={this.bodyReplyType === "code"}
                onChange={() => {
                  this.bodyReplyType = "code"
                  {
                    bodies.forEach((body) => {
                      if (body.replyType === "llm" || body.replyType === "text") {
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
                    mode: 'python', // Enable Python syntax highlighting
                    theme: 'material', // Use the Material theme
                    lineNumbers: true, // Show line numbers
                    tabSize: 4,
                    indentWithTabs: true,
                  }}
                  onBeforeChange={(editor, data, value) => {
                    const body = bodies.find((body) => body.replyType === "code")!;
                    this.props.update(body.id, { name: value }); // Update the backend with the new value
                  }}
                  onChange={(editor, data, value) => {
                    const body = bodies.find((body) => body.replyType === "code")!;
                    if (value.trim()) {
                      this.props.update(body.id, { name: value });
                    } else {

                    }
                  }}
                />
              </ResizableCodeMirrorWrapper>

            </>
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
          Bot Fallback Action
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
                      if (fallbackBody.replyType === "llm") {
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
                      if (body.replyType === "code" || body.replyType === "text") {
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
                value="pythonCode"
                defaultChecked={this.fallbackBodyReplyType === "code"}
                onChange={() => {
                  this.fallbackBodyReplyType = "code"
                  {
                    fallbackBodies.forEach((fallbackBody) => {
                      if (fallbackBody.replyType === "llm" || fallbackBody.replyType === "text") {
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
                    mode: 'python', // Enable Python syntax highlighting
                    theme: 'material', // Use the Material theme
                    lineNumbers: true, // Show line numbers
                    tabSize: 4,
                    indentWithTabs: true,
                  }}
                  onBeforeChange={(editor, data, value) => {
                    const fallbackBody = fallbackBodies.find((fallbackBody) => fallbackBody.replyType === "code")!;
                    this.props.update(fallbackBody.id, { name: value }); // Update the backend with the new value
                  }}
                  onChange={(editor, data, value) => {
                    const fallbackBody = fallbackBodies.find((fallbackBody) => fallbackBody.replyType === "code")!;
                    if (value.trim()) {
                      this.props.update(fallbackBody.id, { name: value });
                    } else {

                    }
                  }}
                />
              </ResizableCodeMirrorWrapper>

            </>
          ) : (<></>)}

        </section>
      </div>
    );
  }

  private create = (Clazz: typeof AgentStateBody | typeof AgentStateFallbackBody, replyType: string) => (value: string) => {
    const { element, create } = this.props;
    const member = new Clazz();
    member.name = value;
    member.replyType = replyType
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