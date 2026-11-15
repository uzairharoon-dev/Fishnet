import { createPatternDetector } from '../pattern';

export const githubTokenDetector = createPatternDetector({
  id: 'github-token',
  type: 'GITHUB_TOKEN',
  patterns: [
    // ghp_ personal, gho_ OAuth, ghu_ user-to-server, ghs_ server-to-server, ghr_ refresh.
    { regex: /\bgh[pousr]_[A-Za-z0-9]{36,255}\b/g, score: 0.95 },
    // Fine-grained personal access token.
    { regex: /\bgithub_pat_[A-Za-z0-9_]{22,255}\b/g, score: 0.95 },
  ],
});
