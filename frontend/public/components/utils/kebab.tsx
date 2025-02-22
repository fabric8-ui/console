import * as _ from 'lodash-es';
import * as React from 'react';
// import * as classNames from 'classnames';
import { connect } from 'react-redux';
// import { EllipsisVIcon } from '@patternfly/react-icons';
import { annotationsModal, configureReplicaCountModal, taintsModal, tolerationsModal, labelsModal, podSelectorModal, deleteModal, expandPVCModal } from '../modals';
import { DropdownMixin } from './dropdown';
import { checkAccess, history, resourceObjPath, useAccessReview } from './index';
import {
  AccessReviewResourceAttributes,
  K8sKind,
  K8sResourceKind,
  K8sResourceKindReference,
  referenceForModel,
} from '../../module/k8s';
import { impersonateStateToProps } from '../../reducers/ui';
import { connectToModel } from '../../kinds';

const KebabItemEnabled: React.FC<KebabItemProps> = ({option, onClick, isActionDropdown}) => {
  if (isActionDropdown) {
    return <a href="#" onClick={(e) => onClick(e, option)} data-test-action={option.label}>{option.label}</a>;
  }
  // return <button className="pf-c-dropdown__menu-item" onClick={(e) => onClick(e, option)} data-test-action={option.label}>{option.label}</button>;
  return <a href="#" onClick={(e) => onClick(e, option)} data-test-action={option.label}>{option.label}</a>;
};

const KebabItemDisabled: React.FC<KebabItemDisabledProps> = ({option, isActionDropdown}) => {
  if (isActionDropdown) {
    return <a className="disabled">{option.label}</a>;
  }
  // return <button className="pf-c-dropdown__menu-item pf-m-disabled">{option.label}</button>;
  return <a className="disabled">{option.label}</a>;
};

const KebabItemAccessReview_ = (props: KebabItemProps & { impersonate: string }) => {
  const { option, impersonate } = props;
  const isAllowed = useAccessReview(option.accessReview, impersonate);
  return isAllowed
    ? <KebabItemEnabled {...props} />
    : <KebabItemDisabled option={option} isActionDropdown={props.isActionDropdown} />;
};
const KebabItemAccessReview = connect(impersonateStateToProps)(KebabItemAccessReview_);

const KebabItem: React.FC<KebabItemProps> = (props) => {
  return props.option.accessReview
    ? <KebabItemAccessReview {...props} />
    : <KebabItemEnabled {...props} />;
};

export const KebabItems: React.SFC<KebabItemsProps> = ({options, onClick, isActionDropdown = false}) => {
  const visibleOptions = _.reject(options, o => _.get(o, 'hidden', false));
  // return <ul className={
  //   classNames({
  //     'pf-c-dropdown__menu pf-m-align-right': !isActionDropdown,
  //     'dropdown-menu dropdown-menu-right dropdown-menu--block co-kebab__dropdown': isActionDropdown,
  //   })} data-test-id="action-items">
  return <ul className="dropdown-menu dropdown-menu-right dropdown-menu--block co-kebab__dropdown">
    {_.map(visibleOptions, (o, i) => <li key={i}>
      <KebabItem option={o} onClick={onClick} isActionDropdown={isActionDropdown} />
    </li>)}
  </ul>;
};

const kebabFactory: KebabFactory = {
  Delete: (kind, obj) => ({
    label: `Delete ${kind.label}`,
    callback: () => deleteModal({
      kind,
      resource: obj,
    }),
    accessReview: {
      group: kind.apiGroup,
      resource: kind.plural,
      name: obj.metadata.name,
      namespace: obj.metadata.namespace,
      verb: 'delete',
    },
  }),
  Edit: (kind, obj) => ({
    label: `Edit ${kind.label}`,
    href: `${resourceObjPath(obj, kind.crd ? referenceForModel(kind) : kind.kind)}/yaml`,
    // TODO: Fallback to "View YAML"? We might want a similar fallback for annotations, labels, etc.
    accessReview: {
      group: kind.apiGroup,
      resource: kind.plural,
      name: obj.metadata.name,
      namespace: obj.metadata.namespace,
      verb: 'update',
    },
  }),
  ModifyLabels: (kind, obj) => ({
    label: 'Edit Labels',
    callback: () => labelsModal({
      kind,
      resource: obj,
      blocking: true,
    }),
    accessReview: {
      group: kind.apiGroup,
      resource: kind.plural,
      name: obj.metadata.name,
      namespace: obj.metadata.namespace,
      verb: 'patch',
    },
  }),
  ModifyPodSelector: (kind, obj) => ({
    label: 'Edit Pod Selector',
    callback: () => podSelectorModal({
      kind,
      resource:  obj,
      blocking: true,
    }),
    accessReview: {
      group: kind.apiGroup,
      resource: kind.plural,
      name: obj.metadata.name,
      namespace: obj.metadata.namespace,
      verb: 'patch',
    },
  }),
  ModifyAnnotations: (kind, obj) => ({
    label: 'Edit Annotations',
    callback: () => annotationsModal({
      kind,
      resource: obj,
      blocking: true,
    }),
    accessReview: {
      group: kind.apiGroup,
      resource: kind.plural,
      name: obj.metadata.name,
      namespace: obj.metadata.namespace,
      verb: 'patch',
    },
  }),
  ModifyCount: (kind, obj) => ({
    label: 'Edit Count',
    callback: () => configureReplicaCountModal({
      resourceKind: kind,
      resource: obj,
    }),
    accessReview: {
      group: kind.apiGroup,
      resource: kind.plural,
      name: obj.metadata.name,
      namespace: obj.metadata.namespace,
      verb: 'patch',
    },
  }),
  ModifyTaints: (kind, obj) => ({
    label: 'Edit Taints',
    callback: () => taintsModal({
      resourceKind: kind,
      resource: obj,
      modalClassName: 'modal-lg',
    }),
    accessReview: {
      group: kind.apiGroup,
      resource: kind.plural,
      name: obj.metadata.name,
      namespace: obj.metadata.namespace,
      verb: 'patch',
    },
  }),
  ModifyTolerations: (kind, obj) => ({
    label: 'Edit Tolerations',
    callback: () => tolerationsModal({
      resourceKind: kind,
      resource: obj,
      modalClassName: 'modal-lg',
    }),
    accessReview: {
      group: kind.apiGroup,
      resource: kind.plural,
      name: obj.metadata.name,
      namespace: obj.metadata.namespace,
      verb: 'patch',
    },
  }),
  AddStorage: (kind, obj) => ({
    label: 'Add Storage',
    href: `${resourceObjPath(obj, kind.crd ? referenceForModel(kind) : kind.kind)}/attach-storage`,
    accessReview: {
      group: kind.apiGroup,
      resource: kind.plural,
      name: obj.metadata.name,
      namespace: obj.metadata.namespace,
      verb: 'patch',
    },
  }),
  ExpandPVC: (kind, obj) => ({
    label: 'Expand PVC',
    callback: () => expandPVCModal({
      kind,
      resource: obj,
    }),
    accessReview: {
      group: kind.apiGroup,
      resource: kind.plural,
      name: obj.metadata.name,
      namespace: obj.metadata.namespace,
      verb: 'patch',
    },
  }),
};

// The common menu actions that most resource share
kebabFactory.common = [kebabFactory.ModifyLabels, kebabFactory.ModifyAnnotations, kebabFactory.Edit, kebabFactory.Delete];

export const ResourceKebab = connectToModel((props: ResourceKebabProps) => {
  const {actions, kindObj, resource, isDisabled} = props;

  if (!kindObj) {
    return null;
  }
  const options = _.reject(actions.map(a => a(kindObj, resource)), 'hidden');
  return <Kebab
    options={options}
    key={resource.metadata.uid}
    isDisabled={isDisabled !== undefined ? isDisabled : _.get(resource.metadata, 'deletionTimestamp')}
  />;
});

export class Kebab extends DropdownMixin {
  static factory: KebabFactory = kebabFactory;

  // public static columnClass: string = 'pf-c-table__action';
  public static columnClass: string = 'dropdown-kebab-pf pf-c-table__action';

  onClick = (event, option: KebabOption) => {
    event.preventDefault();

    if (option.callback) {
      option.callback();
    }

    if (option.href) {
      history.push(option.href);
    }

    this.hide();
  };

  onHover = () => {
    // Check access when hovering over a kebab to minimize flicker when opened.
    // This depends on `checkAccess` being memoized.
    _.each(this.props.options, (option: KebabOption) => {
      if (option.accessReview) {
        checkAccess(option.accessReview);
      }
    });
  }

  render() {
    const {options, isDisabled} = this.props;

    return <div ref={this.dropdownElement} className="co-kebab" onMouseEnter={this.onHover} onFocus={this.onHover}>
      <button type="button" aria-label="Actions" disabled={isDisabled} aria-haspopup="true" className="btn btn-link co-kebab__button" onClick={this.toggle} data-test-id="kebab-button">
        <span className="fa fa-ellipsis-v co-kebab__icon" aria-hidden="true"></span>
      </button>
      {(!isDisabled && this.state.active) && <KebabItems options={options} onClick={this.onClick} />}
    </div>;
    // return <div ref={this.dropdownElement} className={classNames({'pf-c-dropdown': true, 'pf-m-expanded': this.state.active})} onFocus={this.onHover}>
    //   <button type="button" aria-label="Actions" aria-expanded={this.state.active} disabled={isDisabled} aria-haspopup="true" className="pf-c-dropdown__toggle pf-m-plain" onClick={this.toggle} data-test-id="kebab-button">
    //     <EllipsisVIcon />
    //   </button>
    //   {(!isDisabled && this.state.active) && <KebabItems options={options} onClick={this.onClick} />}
    // </div>;
  }
}

export type KebabOption = {
  label: string;
  href?: string, callback?: () => any;
  accessReview?: AccessReviewResourceAttributes;
};
export type KebabAction = (kind: K8sKind, obj: K8sResourceKind) => KebabOption;

export type ResourceKebabProps = {
  kindObj: K8sKind;
  actions: KebabAction[];
  kind: K8sResourceKindReference;
  resource: K8sResourceKind;
  isDisabled?: boolean;
};

type KebabItemProps = {
  option: KebabOption;
  onClick: (event: React.MouseEvent<{}>, option: KebabOption) => void;
  isActionDropdown?: boolean;
};

type KebabItemDisabledProps = {
  option: KebabOption;
  isActionDropdown?: boolean;
}

export type KebabItemsProps = {
  options: KebabOption[];
  onClick: (event: React.MouseEvent<{}>, option: KebabOption) => void;
  isActionDropdown?: boolean;
};

export type KebabFactory = {[name: string]: KebabAction} & {common?: KebabAction[]};

KebabItems.displayName = 'KebabItems';
ResourceKebab.displayName = 'ResourceKebab';
