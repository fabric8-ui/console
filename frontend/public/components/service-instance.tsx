import * as React from 'react';
import * as _ from 'lodash-es';
import { Link, withRouter, RouteComponentProps, match } from 'react-router-dom';
import { sortable } from '@patternfly/react-table';
import * as classNames from 'classnames';
import { k8sList, K8sResourceKind, planExternalName, serviceCatalogStatus, referenceForModel } from '../module/k8s';
import { DetailsPage, ListPage, Table, TableRow, TableData } from './factory';
import {
  ExternalLink,
  Kebab,
  ResourceIcon,
  ResourceKebab,
  ResourceLink,
  ResourceSummary,
  SectionHeading,
  StatusWithIcon,
  Timestamp,
  history,
  navFactory,
} from './utils';
import { ResourceEventStream } from './events';
import { Conditions } from './conditions';
import { ServiceCatalogParameters, ServiceCatalogParametersSecrets } from './service-catalog-parameters';
import { ServiceBindingsPage } from './service-binding';
import { ServiceBindingModel, ServiceInstanceModel, ClusterServiceClassModel } from '../models';

const goToCreateBindingPage = (serviceInstance: K8sResourceKind) => {
  history.push(`/k8s/ns/${serviceInstance.metadata.namespace}/serviceinstances/${serviceInstance.metadata.name}/create-binding`);
};

const createBinding = (kindObj, serviceInstance) => {
  return {
    callback: () => goToCreateBindingPage(serviceInstance),
    label: 'Create Service Binding',
    accessReview: {
      group: ServiceBindingModel.apiGroup,
      resource: ServiceBindingModel.plural,
      namespace: serviceInstance.metadata.namespace,
      verb: 'create',
    },
  };
};

const { common } = Kebab.factory;

const menuActions = [
  createBinding,
  ...common,
];

export const ServiceBindingDescription: React.SFC<ServiceBindingDescriptionProps> = ({instanceName, className}) => <p className={className}>
  Service bindings create a secret containing the necessary information for a workload to use <ResourceIcon kind={referenceForModel(ServiceInstanceModel)} />{instanceName}.
  Once the binding is ready, add the secret to your workload&apos;s environment variables or volumes.
</p>;

class ServiceInstanceMessage_ extends React.Component<ServiceInstanceMessageProps & RouteComponentProps<{}>, ServiceInstanceMessageState> {
  state = {
    hasBindings: false,
    loaded: false,
  };

  componentDidMount() {
    const {obj} = this.props;

    // Get the bindings for this service instance to know what messages to display.
    k8sList(ServiceBindingModel, {ns: obj.metadata.namespace})
      .then(serviceBindings => {
        const hasBindings = _.some(serviceBindings, {spec: {instanceRef: {name: obj.metadata.name}}});
        this.setState({ loaded: true, hasBindings });
      });
  }

  createBinding = () => {
    const {obj} = this.props;
    goToCreateBindingPage(obj);
  };

  render() {
    const {obj, match: {url}} = this.props;
    const {deletionTimestamp} = obj.metadata;
    const {loaded, hasBindings} = this.state;

    if (!loaded) {
      return null;
    }

    // Warn when the instance is deleted, but is still has bindings.
    if (deletionTimestamp && hasBindings) {
      const basePath = url.replace(/\/$/, '');
      return <p className="alert alert-warning co-service-instance-delete-bindings-warning">
        <i className="pficon pficon-warning-triangle-o" aria-hidden="true" />
        This service instance is marked for deletion, but still has bindings.
        You must delete the bindings before the instance will be deleted.&nbsp;&nbsp;
        <Link to={`${basePath}/servicebindings`}>View Service Bindings</Link>
      </p>;
    }

    // Show help for creating a binding when there are none for this instance.
    // TODO: Check if the plan is actually bindable.
    if (!deletionTimestamp && !hasBindings) {
      return <div className="co-well">
        <h4>Create Service Binding</h4>
        <ServiceBindingDescription instanceName={obj.metadata.name} />
        <button className="btn btn-primary" type="button" onClick={this.createBinding}>Create Service Binding</button>
      </div>;
    }

    return null;
  }
}
const ServiceInstanceMessage = withRouter(ServiceInstanceMessage_);

const ServiceInstanceDetails: React.SFC<ServiceInstanceDetailsProps> = ({obj: si}) => {
  const plan = planExternalName(si);
  const parameters = _.get(si, 'status.externalProperties.parameters', {});
  const classDisplayName = si.spec.clusterServiceClassExternalName || si.spec.serviceClassExternalName;
  const clusterServiceClassName = _.get(si, 'spec.clusterServiceClassRef.name');
  const dashboardURL = _.get(si, 'status.dashboardURL');

  return <React.Fragment>
    <ServiceInstanceMessage obj={si} />
    <div className="co-m-pane__body">
      <SectionHeading text="Service Instance Overview" />
      <div className="row">
        <div className="col-sm-6">
          <ResourceSummary resource={si} />
        </div>
        <div className="col-sm-6">
          <dl className="co-m-pane__details">
            <dt>Service Class</dt>
            <dd>
              {clusterServiceClassName
                ? <ResourceLink kind={referenceForModel(ClusterServiceClassModel)} displayName={classDisplayName} title={classDisplayName} name={clusterServiceClassName} />
                : classDisplayName}
            </dd>
            <dt>Status</dt>
            <dd><StatusWithIcon obj={si} /></dd>
            <dt>Plan</dt>
            <dd>{plan || '-'}</dd>
            {dashboardURL && <React.Fragment>
              <dt>Dashboard</dt>
              <dd><ExternalLink href={dashboardURL} text="View Dashboard" /></dd>
            </React.Fragment>}
          </dl>
        </div>
      </div>
    </div>
    <div className="co-m-pane__body">
      <SectionHeading text="Conditions" />
      <Conditions conditions={si.status.conditions} />
    </div>
    {!_.isEmpty(si.spec.parametersFrom) && <ServiceCatalogParametersSecrets obj={si} /> }
    {!_.isEmpty(parameters) && <ServiceCatalogParameters parameters={parameters} /> }
  </React.Fragment>;
};

const ServiceBindingsDetails: React.SFC<ServiceBindingsDetailsProps> = ({obj: si}) => {
  const bindingFilters = {selector: {field: 'spec.instanceRef.name', values: new Set(_.map(si, 'name'))}};

  return <ServiceBindingsPage canCreate={true} createHandler={() => goToCreateBindingPage(si)} namespace={si.metadata.namespace} filters={bindingFilters} autoFocus={false} showTitle={false} />;
};

const pages = [
  navFactory.details(ServiceInstanceDetails),
  navFactory.editYaml(),
  navFactory.events(ResourceEventStream),
  navFactory.serviceBindings(ServiceBindingsDetails),
];

export const ServiceInstanceDetailsPage: React.SFC<ServiceInstanceDetailsPageProps> = props =>
  <DetailsPage
    {...props}
    kind={referenceForModel(ServiceInstanceModel)}
    menuActions={menuActions}
    pages={pages} />;
ServiceInstanceDetailsPage.displayName = 'ServiceInstanceDetailsPage';

const tableColumnClasses = [
  classNames('col-md-2', 'col-sm-4', 'col-xs-6'),
  classNames('col-md-2', 'col-sm-3', 'col-xs-6'),
  classNames('col-md-2', 'col-sm-3', 'hidden-xs'),
  classNames('col-md-2', 'col-sm-2', 'hidden-xs'),
  classNames('col-md-2', 'hidden-sm', 'hidden-xs'),
  classNames('col-md-2', 'hidden-sm', 'hidden-xs'),
  Kebab.columnClass,
];

const ServiceInstancesTableHeader = () => {
  return [
    {
      title: 'Name', sortField: 'metadata.name', transforms: [sortable],
      props: { className: tableColumnClasses[0] },
    },
    {
      title: 'Namespace', sortField: 'metadata.namespace', transforms: [sortable],
      props: { className: tableColumnClasses[1] },
    },
    {
      title: 'Service Class', sortField: 'spec.clusterServiceClassExternalName', transforms: [sortable],
      props: { className: tableColumnClasses[2] },
    },
    {
      title: 'Status', sortFunc: 'serviceCatalogStatus', transforms: [sortable],
      props: { className: tableColumnClasses[3] },
    },
    {
      title: 'Plan', sortFunc: 'planExternalName', transforms: [sortable],
      props: { className: tableColumnClasses[4] },
    },
    {
      title: 'Created', sortField: 'metadata.creationTimestamp', transforms: [sortable],
      props: { className: tableColumnClasses[5] },
    },
    {
      title: '', props: { className: tableColumnClasses[6] },
    },
  ];
};
ServiceInstancesTableHeader.displayName = 'ServiceInstancesTableHeader';

const ServiceInstancesTableRow: React.FC<ServiceInstancesTableRowProps> = ({obj, index, key, style}) => {
  const clusterServiceClassRefName = _.get(obj, 'spec.clusterServiceClassRef.name');
  return (
    <TableRow id={obj.metadata.uid} index={index} trKey={key} style={style}>
      <TableData className={tableColumnClasses[0]}>
        <ResourceLink kind={referenceForModel(ServiceInstanceModel)} name={obj.metadata.name} namespace={obj.metadata.namespace} title={obj.metadata.name} />
      </TableData>
      <TableData className={classNames(tableColumnClasses[1], 'co-break-word')}>
        <ResourceLink kind="Namespace" name={obj.metadata.namespace} title={obj.metadata.namespace} />
      </TableData>
      <TableData className={classNames(tableColumnClasses[2], 'co-break-word')}>
        {clusterServiceClassRefName
          ? <ResourceLink kind={referenceForModel(ClusterServiceClassModel)} displayName={obj.spec.clusterServiceClassExternalName} title={obj.spec.clusterServiceClassExternalName} name={obj.spec.clusterServiceClassRef.name} />
          : obj.spec.clusterServiceClassExternalName }
      </TableData>
      <TableData className={tableColumnClasses[3]}>
        <StatusWithIcon obj={obj} />
      </TableData>
      <TableData className={classNames(tableColumnClasses[4], 'co-break-word')}>
        {planExternalName(obj) || '-'}
      </TableData>
      <TableData className={classNames(tableColumnClasses[5], 'co-truncate')}>
        <Timestamp timestamp={obj.metadata.creationTimestamp} />
      </TableData>
      <TableData className={tableColumnClasses[6]}>
        <ResourceKebab actions={menuActions} kind={referenceForModel(ServiceInstanceModel)} resource={obj} />
      </TableData>
    </TableRow>
  );
};
ServiceInstancesTableRow.displayName = 'ServiceInstancesTableRow';
type ServiceInstancesTableRowProps = {
  obj: K8sResourceKind;
  index: number;
  key?: string;
  style: object;
};

const ServiceInstancesList: React.SFC = props => <Table {...props} aria-label="Service Instances" Header={ServiceInstancesTableHeader} Row={ServiceInstancesTableRow} virtualize />;
ServiceInstancesList.displayName = 'ServiceInstancesList';

const filters = [{
  type: 'catalog-status',
  selected: ['Ready', 'Not Ready', 'Failed'],
  reducer: serviceCatalogStatus,
  items: [
    {id: 'Ready', title: 'Ready'},
    {id: 'Not Ready', title: 'Not Ready'},
    {id: 'Failed', title: 'Failed'},
  ],
}];

export const ServiceInstancesPage: React.SFC<ServiceInstancesPageProps> = props =>
  <ListPage
    {...props}
    namespace={_.get(props.match, 'params.ns')}
    kind={referenceForModel(ServiceInstanceModel)}
    ListComponent={ServiceInstancesList}
    rowFilters={filters}
    showTitle={false}
  />;
ServiceInstancesPage.displayName = 'ServiceInstancesListPage';

export type ServiceInstanceStatusProps = {
  obj: K8sResourceKind
};

export type ServiceInstanceDetailsProps = {
  obj: K8sResourceKind,
};

export type ServiceBindingDescriptionProps = {
  instanceName: string,
  className?: string,
};

export type ServiceInstanceMessageProps = {
  obj: K8sResourceKind,
};

export type ServiceInstanceMessageState = {
  hasBindings: boolean,
  loaded: boolean,
};

export type ServiceBindingsDetailsProps = {
  obj: any,
};

export type ServiceInstancesPageProps = {
  showTitle?: boolean,
  namespace?: string,
  match?: match<{ns?: string}>,
  selector?: any,
};

export type ServiceInstanceDetailsPageProps = {
  match: any,
};
