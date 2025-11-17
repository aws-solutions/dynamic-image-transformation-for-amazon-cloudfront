import ReactDOM from 'react-dom/client';
import App from './App';
import { Amplify } from 'aws-amplify';
import { cognitoUserPoolsTokenProvider } from 'aws-amplify/auth/cognito';
import { ResourcesConfig } from '@aws-amplify/core';
import './mocks/browser';
import React from 'react';
import { sessionStorage } from 'aws-amplify/utils';


loadConfigAndRenderApp();

async function loadConfigAndRenderApp() {
  const response = await fetch('/amplify-config.json', {
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    }
  });
  
  const amplifyV1Config = await response.json();

  // map legacy config to expected config format of Amplify gen2
  const amplifyV2Config: ResourcesConfig = {
    Auth: {
      Cognito: {
        userPoolId: amplifyV1Config.Auth.Cognito.userPoolId,
        userPoolClientId: amplifyV1Config.Auth.Cognito.userPoolClientId,
        loginWith: {
          oauth: {
            domain: amplifyV1Config.Auth.Cognito.loginWith.oauth.domain,
            redirectSignIn: amplifyV1Config.Auth.Cognito.loginWith.oauth.redirectSignIn,
            redirectSignOut: amplifyV1Config.Auth.Cognito.loginWith.oauth.redirectSignOut,
            responseType: "code",
            scopes: amplifyV1Config.Auth.Cognito.loginWith.oauth.scopes,
            providers: []
          }
        }
      }
    },
    API: {
      REST: {
        AdminAPI: {
          endpoint: amplifyV1Config.API.REST.AdminAPI.endpoint
        }
      }
    }
  };

  Amplify.configure(amplifyV2Config);
  
  cognitoUserPoolsTokenProvider.setKeyValueStorage(sessionStorage);

  const root = ReactDOM.createRoot(document.getElementById('root')!);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}