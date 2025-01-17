import React, { useState, useEffect } from 'react';
import { WorkflowSource, ParamKind, CustomParam } from '../../../src/types/workflow';
import { RawWorkflow } from '../../../src/types';

interface Props {
  workflows: Map<string, RawWorkflow>;
  onWorkflowChange: (id: string) => void;
  onParamsChange: (params: Record<string, any>) => void;
  onGenerate: () => void;
  onApplyResult: () => void;
}

// 参数组件接口
interface ParamProps {
  param: CustomParam;
  value: any;
  onChange: (value: any) => void;
}

// 数字参数组件
const NumberParam: React.FC<ParamProps> = ({ param, value, onChange }) => {
  const isInt = param.kind === ParamKind.NumberInt;
  const step = isInt ? 1 : 0.1;
  
  return (
    <div className="param-number">
      <input
        type="range"
        min={param.min ?? (isInt ? -(2**31) : 0)}
        max={param.max ?? (isInt ? 2**31 - 1 : 1)}
        step={step}
        value={value}
        onChange={e => onChange(isInt ? parseInt(e.target.value) : parseFloat(e.target.value))}
      />
      <input
        type="number"
        value={value}
        step={step}
        onChange={e => onChange(isInt ? parseInt(e.target.value) : parseFloat(e.target.value))}
      />
    </div>
  );
};

// 文本参数组件
const TextParam: React.FC<ParamProps> = ({ param, value, onChange }) => {
  return (
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={param.displayName}
    />
  );
};

// 切换参数组件
const ToggleParam: React.FC<ParamProps> = ({ param, value, onChange }) => {
  return (
    <label className="param-toggle">
      <input
        type="checkbox"
        checked={value}
        onChange={e => onChange(e.target.checked)}
      />
      <span>{value ? 'On' : 'Off'}</span>
    </label>
  );
};

// 选择参数组件
const ChoiceParam: React.FC<ParamProps> = ({ param, value, onChange }) => {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}>
      {param.choices?.map(choice => (
        <option key={choice} value={choice}>
          {choice}
        </option>
      ))}
    </select>
  );
};

// 提示词参数组件
const PromptParam: React.FC<ParamProps> = ({ param, value, onChange }) => {
  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={param.displayName}
      rows={param.kind === ParamKind.PromptPositive ? 3 : 2}
    />
  );
};

// 参数组件工厂
const ParamComponent: React.FC<ParamProps> = (props) => {
  switch (props.param.kind) {
    case ParamKind.NumberInt:
    case ParamKind.NumberFloat:
      return <NumberParam {...props} />;
    case ParamKind.Toggle:
      return <ToggleParam {...props} />;
    case ParamKind.Text:
      return <TextParam {...props} />;
    case ParamKind.PromptPositive:
    case ParamKind.PromptNegative:
      return <PromptParam {...props} />;
    case ParamKind.Choice:
      return <ChoiceParam {...props} />;
    default:
      return null;
  }
};

// 参数组组件
const ParamGroup: React.FC<{
  name: string;
  params: CustomParam[];
  values: Record<string, any>;
  onChange: (name: string, value: any) => void;
}> = ({ name, params, values, onChange }) => {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="param-group">
      <div className="param-group-header" onClick={() => setExpanded(!expanded)}>
        <span>{name || 'Parameters'}</span>
        <button onClick={() => setExpanded(!expanded)}>
          {expanded ? '▼' : '▶'}
        </button>
      </div>
      {expanded && (
        <div className="param-group-content">
          {params.map(param => (
            <div key={param.name} className="param-item">
              <label>{param.displayName}</label>
              <ParamComponent
                param={param}
                value={values[param.name] ?? param.default}
                onChange={value => onChange(param.name, value)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// 主组件
export const CustomWorkflow: React.FC<Props> = ({
  workflows,
  onWorkflowChange,
  onParamsChange,
  onGenerate,
  onApplyResult
}) => {
  const [selectedId, setSelectedId] = useState<string>('');
  const [params, setParams] = useState<Record<string, any>>({});
  const [editMode, setEditMode] = useState(false);
  const [editName, setEditName] = useState('');

  // 工作流改变时重置参数
  useEffect(() => {
    if (selectedId) {
      const workflow = workflows.get(selectedId);
      if (workflow) {
        // 提取参数默认值
        const defaultParams = {};
        // TODO: 使用 extractWorkflowParameters 提取参数
        setParams(defaultParams);
        onParamsChange(defaultParams);
      }
    }
  }, [selectedId, workflows]);

  // 参数改变时通知父组件
  const handleParamChange = (name: string, value: any) => {
    const newParams = { ...params, [name]: value };
    setParams(newParams);
    onParamsChange(newParams);
  };

  // 保存工作流
  const handleSave = () => {
    if (editName.trim()) {
      // TODO: 保存工作流
      setEditMode(false);
    }
  };

  return (
    <div className="custom-workflow">
      <div className="workflow-header">
        {editMode ? (
          <div className="workflow-edit">
            <input
              type="text"
              value={editName}
              onChange={e => setEditName(e.target.value)}
              placeholder="Workflow name"
            />
            <button onClick={handleSave}>Save</button>
            <button onClick={() => setEditMode(false)}>Cancel</button>
          </div>
        ) : (
          <div className="workflow-select">
            <select
              value={selectedId}
              onChange={e => {
                setSelectedId(e.target.value);
                onWorkflowChange(e.target.value);
              }}
            >
              <option value="">Select workflow...</option>
              {Array.from(workflows.entries()).map(([id, workflow]) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </select>
            <button onClick={() => setEditMode(true)}>Save As</button>
            <button onClick={() => {/* TODO: 导入工作流 */}}>Import</button>
            <button onClick={() => {/* TODO: 删除工作流 */}}>Delete</button>
          </div>
        )}
      </div>

      <div className="workflow-params">
        {/* 按组显示参数 */}
        {Object.entries(
          // 将参数按组分类
          Object.entries(params).reduce((groups, [name, value]) => {
            const param = params[name];
            const group = param?.group || '';
            return {
              ...groups,
              [group]: [...(groups[group] || []), param]
            };
          }, {} as Record<string, CustomParam[]>)
        ).map(([group, groupParams]) => (
          <ParamGroup
            key={group}
            name={group}
            params={groupParams}
            values={params}
            onChange={handleParamChange}
          />
        ))}
      </div>

      <div className="workflow-actions">
        <button onClick={onGenerate}>Generate</button>
        <button onClick={onApplyResult}>Apply Result</button>
      </div>
    </div>
  );
}; 