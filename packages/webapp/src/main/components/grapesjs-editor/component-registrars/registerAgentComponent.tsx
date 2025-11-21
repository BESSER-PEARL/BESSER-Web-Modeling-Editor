import React from 'react';
import ReactDOM from 'react-dom/client';
import { getAgentOptions } from '../diagram-helpers';

/**
 * Build agent component props from attributes
 */
const buildAgentProps = (attrs: Record<string, any>): any => {
  const props: any = {
    'agent-name': attrs['agent-name'] || '',
    'agent-title': attrs['agent-title'] || 'BESSER Agent',
  };

  return props;
};

/**
 * Agent Component React component for preview - matches the actual React component design
 */
const AgentComponentPreview: React.FC<{ 
  agentName: string; 
  agentTitle: string; 
}> = ({ 
  agentName, 
  agentTitle,
}) => {
  const containerStyle: React.CSSProperties = {
    minHeight: '400px',
    border: '1px solid #ddd',
    borderRadius: '8px',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#fff',
    overflow: 'hidden',
  };

  const headerStyle: React.CSSProperties = {
    padding: '15px',
    borderBottom: '1px solid #ddd',
    backgroundColor: '#f5f5f5',
    borderRadius: '8px 8px 0 0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  };

  const statusStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '12px',
    color: '#999',
  };

  const messagesStyle: React.CSSProperties = {
    flex: 1,
    overflowY: 'auto',
    padding: '15px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    backgroundColor: '#fafafa',
    minHeight: '200px',
  };

  const inputContainerStyle: React.CSSProperties = {
    padding: '15px',
    borderTop: '1px solid #ddd',
    display: 'flex',
    gap: '10px',
    backgroundColor: '#fff',
  };

  const inputStyle: React.CSSProperties = {
    flex: 1,
    padding: '10px',
    border: '1px solid #ddd',
    borderRadius: '6px',
    fontSize: '14px',
  };

  const buttonStyle: React.CSSProperties = {
    padding: '10px 20px',
    backgroundColor: '#007bff',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '14px',
  };

  return (
    <div style={containerStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <img 
            src="/img/agent_back.png" 
            alt="Agent" 
            style={{ 
              width: '32px', 
              height: '32px', 
              borderRadius: '50%',
              objectFit: 'contain',
            }} 
          />
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '500' }}>{agentTitle}</h3>
        </div>
        <div style={statusStyle}>
          <span>○</span>
          <span>Preview Mode</span>
        </div>
      </div>

      {/* Messages Area */}
      <div style={messagesStyle}>
        {agentName ? (
          <>
            <div style={{
              padding: '10px 15px',
              borderRadius: '12px',
              maxWidth: '70%',
              alignSelf: 'flex-start',
              backgroundColor: '#e9ecef',
              color: '#333',
            }}>
              Hello! I'm {agentName}. How can I help you?
            </div>
            <div style={{
              padding: '10px 15px',
              borderRadius: '12px',
              maxWidth: '70%',
              alignSelf: 'flex-end',
              backgroundColor: '#007bff',
              color: '#fff',
            }}>
              This is a preview of the chat interface
            </div>
          </>
        ) : (
          <div style={{ 
            textAlign: 'center', 
            color: '#999', 
            padding: '20px',
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            Select an agent to start chatting...
          </div>
        )}
      </div>

      {/* Input Area */}
      <div style={inputContainerStyle}>
        <input
          type="text"
          placeholder={agentName ? "Type a message..." : "Select an agent first"}
          disabled={!agentName}
          style={inputStyle}
          readOnly
        />
        <button 
          disabled={!agentName} 
          style={{
            ...buttonStyle,
            opacity: agentName ? 1 : 0.6,
            cursor: agentName ? 'pointer' : 'not-allowed',
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
};

/**
 * Register agent component in the GrapesJS editor
 * @param editor - GrapesJS editor instance
 */
export const registerAgentComponent = (editor: any) => {
  const traitAttributes: Record<string, any> = { 
    class: 'agent-component',
    'agent-name': '',
    'agent-title': 'BESSER Agent',
  };

  const baseDefaults = {
    tagName: 'div',
    draggable: true,
    droppable: false,
    attributes: traitAttributes,
    style: {
      width: '100%',
      'min-height': '400px',
    },
  };

  editor.Components.addType('agent-component', {
    model: {
      defaults: baseDefaults,
      init(this: any) {
        const traits = this.get('traits');
        
        // Define traits for the agent component
        const agentOptions = getAgentOptions();
        
        traits.reset([
          {
            type: 'select',
            label: 'Agent',
            name: 'agent-name',
            value: agentOptions.length > 0 ? agentOptions[0].value : '',
            changeProp: 1,
            options: agentOptions,
          },
          {
            type: 'text',
            label: 'Agent Title',
            name: 'agent-title',
            value: 'BESSER Agent',
            changeProp: 1,
          },
        ]);

        // Ensure all trait values are set in attributes
        const attrs = this.get('attributes') || {};
        let changed = false;
        traits.each((trait: any) => {
          const traitName = trait.get('name');
          if (attrs[traitName] === undefined || attrs[traitName] === null) {
            attrs[traitName] = trait.get('value') !== undefined && trait.get('value') !== null ? trait.get('value') : '';
            changed = true;
          }
        });
        if (changed) {
          this.set('attributes', attrs);
        }

        // On init, copy all values from attributes to top-level for traits
        traits.each((trait: any) => {
          const traitName = trait.get('name');
          if (attrs[traitName] !== undefined) {
            this.set(traitName, attrs[traitName]);
          }
        });

        // Synchronize trait property changes to attributes
        traits.each((trait: any) => {
          const traitName = trait.get('name');
          this.on(`change:${traitName}`, () => {
            const currentAttrs = { ...(this.get('attributes') || {}) };
            currentAttrs[traitName] = this.get(traitName);
            this.set('attributes', currentAttrs);
            // Re-render agent component for any trait change
            this.renderAgentComponent();
          });
        });

        // Update agent-name trait with fresh agent options
        const agentNameTrait = traits.where({ name: 'agent-name' })[0];
        if (agentNameTrait) {
          const updatedOptions = getAgentOptions();
          agentNameTrait.set('options', updatedOptions);
        }

        // Refresh options when project changes
        editor.on('component:add component:remove', () => {
          setTimeout(() => {
            const updatedOptions = getAgentOptions();
            if (agentNameTrait) {
              agentNameTrait.set('options', updatedOptions);
            }
          }, 100);
        });
      },
      
      renderAgentComponent(this: any) {
        const attrs = this.get('attributes') || {};
        const view = this.getView();
        if (view && view.el) {
          const container = view.el;
          container.innerHTML = '';
          const root = ReactDOM.createRoot(container);
          const props = buildAgentProps(attrs);
          root.render(React.createElement(AgentComponentPreview, {
            agentName: props['agent-name'] || '',
            agentTitle: props['agent-title'] || 'BESSER Agent',
          }));
        }
      },
    },
    view: {
      onRender({ el, model }: any) {
        const attrs = model.get('attributes') || {};
        const root = ReactDOM.createRoot(el);
        const props = buildAgentProps(attrs);
        root.render(React.createElement(AgentComponentPreview, {
          agentName: props['agent-name'] || '',
          agentTitle: props['agent-title'] || 'BESSER Agent',
        }));
      },
    },
    isComponent: (el: any) => {
      if (el.classList && el.classList.contains('agent-component')) {
        return { type: 'agent-component' };
      }
    },
  });

  // Add agent component to Block Manager
  editor.BlockManager.add('agent-component', {
    label: 'BESSER Agent',
    category: 'Basic',
    content: { type: 'agent-component' },
    media: '<img src="/img/agent_back.png" alt="Agent" style="width: 24px; height: 24px; border-radius: 50%; object-fit: contain;" />',
  });
};

