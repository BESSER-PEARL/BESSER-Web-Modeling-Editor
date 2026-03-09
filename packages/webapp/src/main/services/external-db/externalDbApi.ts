import { BACKEND_URL } from '../../constant';

export const fetchDatabaseMetadata = async (connection_url: string): Promise<any> => {
    const response = await fetch(`${BACKEND_URL}/external-db/metadata`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
        },
        body: JSON.stringify({ connection_url }),
    });

    if (!response.ok) {
        let errorMessage = 'Failed to fetch database metadata';
        try {
            const errorData = await response.json();
            errorMessage = errorData.detail || errorMessage;
        } catch (e) {
            // ignore JSON parse error
        }
        throw new Error(errorMessage);
    }

    return await response.json();
};
