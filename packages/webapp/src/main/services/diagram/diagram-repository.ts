import { BASE_URL } from '../../constant';
import { DiagramDTO } from 'shared';
import { Diagram } from './diagramSlice';

export const DiagramRepository = {
  getDiagramFromServerByToken(token: string): Promise<DiagramDTO | null> {
    const resourceUrl = `${BASE_URL}/diagrams/${token}`;
    return fetch(resourceUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })
      .then((response) => {
        if (response.ok) {
          return response.json();
        } else {
          // error occured or no diagram found
          return null;
        }
      })
      .catch(() => {
        return null;
      });
  },
  publishDiagramVersionOnServer(
    diagram: Diagram,
    token?: string,
  ): Promise<{ diagramToken: string; diagram: DiagramDTO }> {
    const resourceUrl = `${BASE_URL}/diagrams/publish`;
    const body = JSON.stringify({ diagram, token });
    return fetch(resourceUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body,
    }).then((response: Response) => {
      if (response.ok) {
        return response.json();
      } else {
        // error occured or no diagram found
        throw Error('Publish of diagram failed');
      }
    });
  },
  editDiagramVersionOnServer(
    token: string,
    versionIndex: number,
    title: string,
    description: string,
  ): Promise<DiagramDTO> {
    const resourceUrl = `${BASE_URL}/diagrams/${token}`;
    const body = JSON.stringify({
      versionIndex,
      title,
      description,
    });
    return fetch(resourceUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body,
    }).then((response: Response) => {
      if (response.ok) {
        return response.json();
      } else {
        throw Error('Editing the diagram failed');
      }
    });
  },
  deleteDiagramVersionOnServer(token: string, versionIndex: number): Promise<DiagramDTO> {
    const resourceUrl = `${BASE_URL}/diagrams/${token}`;
    const body = JSON.stringify({
      versionIndex,
    });
    return fetch(resourceUrl, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
      body,
    }).then((response: Response) => {
      if (response.ok) {
        return response.json();
      } else {
        throw Error('Deleting the diagram version failed');
      }
    });
  },
  convertSvgToPdf(svg: string, width: number, height: number): Promise<Blob | undefined> {
    const resourceUrl = `${BASE_URL}/diagrams/pdf`;
    const body = JSON.stringify({ svg, width, height });
    return fetch(resourceUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body,
    }).then((response) => {
      if (response.ok) {
        return response.blob();
      } else {
        // error occured or no diagram found
        return undefined;
      }
    });
  },
};
