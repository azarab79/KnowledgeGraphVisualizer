import { useState, useEffect } from 'react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

export function useDocumentation(expandedDoc) {
  const [docContent, setDocContent] = useState('');
  const [docLoading, setDocLoading] = useState(false);
  const [docError, setDocError] = useState(null);

  useEffect(() => {
    marked.setOptions({
      gfm: true,
      breaks: true,
      sanitize: false,
      headerIds: true,
      mangle: false
    });

    const loadDocContent = async () => {
      if (!expandedDoc) {
        setDocContent('');
        setDocError(null);
        return;
      }

      setDocLoading(true);
      setDocError(null);

      try {
        const response = await fetch(`/api/docs/${expandedDoc}.md`);
        if (!response.ok) {
          throw new Error(`Failed to load documentation: ${response.status} ${response.statusText}`);
        }

        const contentType = response.headers.get('content-type');
        if (!contentType || (!contentType.includes('text/markdown') && !contentType.includes('text/plain'))) {
          throw new Error(`Invalid content type: ${contentType}`);
        }

        const content = await response.text();
        if (!content.trim()) {
          throw new Error('Received empty content from server');
        }

        const renderedContent = marked.parse(content);
        const sanitizedContent = DOMPurify.sanitize(renderedContent, {
          ADD_TAGS: ['table', 'thead', 'tbody', 'tr', 'th', 'td'],
          ADD_ATTR: ['align']
        });

        if (!sanitizedContent.trim()) {
          throw new Error('Content processing resulted in empty output');
        }

        setDocContent(sanitizedContent);
      } catch (error) {
        console.error('useDocumentation error:', error);
        setDocError(error instanceof Error ? error.message : String(error));
      } finally {
        setDocLoading(false);
      }
    };

    loadDocContent();
  }, [expandedDoc]);

  return { docContent, docLoading, docError };
}
