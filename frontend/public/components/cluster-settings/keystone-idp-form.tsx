import * as React from 'react';
import { Helmet } from 'react-helmet';
import * as _ from 'lodash-es';

import { SecretModel, ConfigMapModel } from '../../models';
import { IdentityProvider, k8sCreate, K8sResourceKind, OAuthKind } from '../../module/k8s';
import { ButtonBar, PromiseComponent, history, AsyncComponent } from '../utils';
import { addIDP, getOAuthResource, redirectToOAuthPage } from './';
import { IDPNameInput } from './idp-name-input';
import { IDPCAFileInput } from './idp-cafile-input';

const DroppableFileInput = (props: any) => <AsyncComponent loader={() => import('../utils/file-input').then(c => c.DroppableFileInput)} {...props} />;

export class AddKeystonePage extends PromiseComponent<{}, AddKeystonePageState> {
  readonly state: AddKeystonePageState = {
    name: 'keystone',
    domainName: '',
    url: '',
    caFileContent: '',
    certFileContent: '',
    keyFileContent: '',
    inProgress: false,
    errorMessage: '',
  };

  getOAuthResource(): Promise<OAuthKind> {
    return this.handlePromise(getOAuthResource());
  }

  createTLSSecret(): Promise<K8sResourceKind> {
    const { certFileContent, keyFileContent } = this.state;
    if (!certFileContent) {
      return Promise.resolve(null);
    }

    const secret = {
      apiVersion: 'v1',
      kind: 'Secret',
      metadata: {
        generateName: 'keystone-tls-',
        namespace: 'openshift-config',
      },
      stringData: {
        'tls.crt': certFileContent,
        'tls.key': keyFileContent,
      },
    };

    return this.handlePromise(k8sCreate(SecretModel, secret));
  }

  createCAConfigMap(): Promise<K8sResourceKind> {
    const { caFileContent } = this.state;
    if (!caFileContent) {
      return Promise.resolve(null);
    }

    const ca = {
      apiVersion: 'v1',
      kind: 'ConfigMap',
      metadata: {
        generateName: 'keystone-ca-',
        namespace: 'openshift-config',
      },
      stringData: {
        'ca.crt': caFileContent,
      },
    };

    return this.handlePromise(k8sCreate(ConfigMapModel, ca));
  }

  addKeystoneIDP(oauth: OAuthKind, secretName: string, caName: string): Promise<K8sResourceKind> {
    const { name, domainName, url } = this.state;
    const idp: IdentityProvider = {
      name,
      type: 'Keystone',
      mappingMethod: 'claim',
      keystone: {
        domainName,
        url,
      },
    };

    if (caName) {
      idp.keystone.ca = {
        name: caName,
      };
    }

    if (secretName) {
      idp.keystone.tlsClientCert = {
        name: secretName,
      };
      idp.keystone.tlsClientKey = {
        name: secretName,
      };
    }

    return this.handlePromise(addIDP(oauth, idp));
  }

  submit: React.FormEventHandler<HTMLFormElement> = (e) => {
    e.preventDefault();
    if (_.isEmpty(this.state.keyFileContent) !== _.isEmpty(this.state.certFileContent)) {
      this.setState({errorMessage: 'Values for Certificate and Key should both be either excluded or provided.'});
      return;
    }
    // Clear any previous errors.
    this.setState({errorMessage: ''});
    this.getOAuthResource().then((oauth: OAuthKind) => {
      const promises = [
        this.createTLSSecret(),
        this.createCAConfigMap(),
      ];

      Promise.all(promises).then(([tlsSecret, configMap]) => {
        const caName = configMap ? configMap.metadata.name : '';
        const secretName = tlsSecret ? tlsSecret.metadata.name: '';
        return this.addKeystoneIDP(oauth, secretName, caName);
      }).then(redirectToOAuthPage);
    });
  };

  nameChanged: React.ReactEventHandler<HTMLInputElement> = (event) => {
    this.setState({name: event.currentTarget.value});
  };

  domainNameChanged: React.ReactEventHandler<HTMLInputElement> = (event) => {
    this.setState({domainName: event.currentTarget.value});
  };

  urlChanged: React.ReactEventHandler<HTMLInputElement> = (event) => {
    this.setState({url: event.currentTarget.value});
  };

  caFileChanged = (caFileContent: string) => {
    this.setState({caFileContent});
  };

  certFileChanged = (certFileContent: string) => {
    this.setState({certFileContent});
  };

  keyFileChanged = (keyFileContent: string) => {
    this.setState({keyFileContent});
  };

  render() {
    const { name, domainName, url, caFileContent, certFileContent, keyFileContent } = this.state;
    const title = 'Add Identity Provider: Keystone Authentication';
    return <div className="co-m-pane__body">
      <Helmet>
        <title>{title}</title>
      </Helmet>
      <form onSubmit={this.submit} name="form" className="co-m-pane__body-group co-m-pane__form">
        <h1 className="co-m-pane__heading">{title}</h1>
        <p className="co-m-pane__explanation">
          Adding Keystone enables shared authentication with an OpenStack server configured to store users in an internal Keystone database.
        </p>
        <IDPNameInput value={name} onChange={this.nameChanged} />
        <div className="form-group">
          <label className="control-label co-required" htmlFor="domain-name">Domain Name</label>
          <input className="form-control"
            type="text"
            onChange={this.domainNameChanged}
            value={domainName}
            id="domain-name"
            required />
        </div>
        <div className="form-group">
          <label className="control-label co-required" htmlFor="url">URL</label>
          <input className="form-control"
            type="text"
            onChange={this.urlChanged}
            value={url}
            id="url"
            aria-describedby="idp-url-help"
            required />
          <p className="help-block" id="idp-url-help">
            The remote URL to connect to.
          </p>
        </div>
        <IDPCAFileInput value={caFileContent} onChange={this.caFileChanged} />
        <div className="form-group">
          <DroppableFileInput
            onChange={this.certFileChanged}
            inputFileData={certFileContent}
            id="cert-file-input"
            label="Certificate"
            hideContents
            inputFieldHelpText="PEM-encoded TLS client certificate to present when connecting to the server." />
        </div>
        <div className="form-group">
          <DroppableFileInput
            onChange={this.keyFileChanged}
            inputFileData={keyFileContent}
            id="key-file-input"
            label="Key"
            hideContents
            inputFieldHelpText="PEM-encoded TLS private key for the client certificate. Required if Certificate is specified." />
        </div>
        <ButtonBar errorMessage={this.state.errorMessage} inProgress={this.state.inProgress}>
          <button type="submit" className="btn btn-primary">Add</button>
          <button type="button" className="btn btn-default" onClick={history.goBack}>Cancel</button>
        </ButtonBar>
      </form>
    </div>;
  }
}

type AddKeystonePageState = {
  name: string;
  domainName: string;
  url: string
  caFileContent: string;
  certFileContent: string;
  keyFileContent: string;
  inProgress: boolean;
  errorMessage: string;
};
