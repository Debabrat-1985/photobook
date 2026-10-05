// Vercel Serverless Function: Public Book Fetcher by slug using Firestore REST API
export default async function handler(req, res) {
  const { slug } = req.query;

  if (!slug) {
    return res.status(400).json({ error: 'Missing slug parameter' });
  }

  const projectId = process.env.VITE_FIREBASE_PROJECT_ID || 'edurunner-saas';

  try {
    // Query Firestore via REST API for public book matching slug
    const firestoreUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`;

    const queryBody = {
      structuredQuery: {
        from: [{ collectionId: 'books' }],
        where: {
          compositeFilter: {
            op: 'AND',
            filters: [
              {
                fieldFilter: {
                  field: { fieldPath: 'public_slug' },
                  op: 'EQUAL',
                  value: { stringValue: slug },
                },
              },
              {
                fieldFilter: {
                  field: { fieldPath: 'is_public' },
                  op: 'EQUAL',
                  value: { booleanValue: true },
                },
              },
            ],
          },
        },
        limit: 1,
      },
    };

    const queryRes = await fetch(firestoreUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(queryBody),
    });

    if (!queryRes.ok) {
      return res.status(404).json({ error: 'Public book not found or private' });
    }

    const queryData = await queryRes.json();
    if (!queryData || !queryData[0] || !queryData[0].document) {
      return res.status(404).json({ error: 'Public book not found or private' });
    }

    const rawDoc = queryData[0].document;
    const fields = rawDoc.fields || {};
    const bookId = rawDoc.name.split('/').pop();

    const book = {
      id: bookId,
      title: fields.title?.stringValue || 'Memory Book',
      subtitle: fields.subtitle?.stringValue || '',
      author: fields.author?.stringValue || '',
      publish_date: fields.publish_date?.stringValue || '',
      dedication: fields.dedication?.stringValue || '',
      category: fields.category?.stringValue || 'Personal',
      template_id: fields.template_id?.stringValue || 'classic',
      cover_image_url: fields.cover_image_url?.stringValue || '',
      is_public: true,
      public_slug: slug,
    };

    // Fetch pages subcollection
    const pagesUrl = `https://firestore.googleapis.com/v1/${rawDoc.name}/pages`;
    const pagesRes = await fetch(pagesUrl);
    let pages = [];
    if (pagesRes.ok) {
      const pagesData = await pagesRes.json();
      if (pagesData.documents) {
        pages = pagesData.documents.map((pDoc) => {
          const pFields = pDoc.fields || {};
          return {
            id: pDoc.name.split('/').pop(),
            page_number: parseInt(pFields.page_number?.integerValue || '0', 10),
            title: pFields.title?.stringValue || '',
            description: pFields.description?.stringValue || '',
            image_url: pFields.image_url?.stringValue || '',
          };
        });
        pages.sort((a, b) => a.page_number - b.page_number);
      }
    }

    return res.status(200).json({ book, pages });
  } catch (error) {
    console.error('Fetch public book error:', error);
    return res.status(500).json({ error: error.message });
  }
}
