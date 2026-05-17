# Stories board skills

Phase exit skills for the stories workflow. Devflow scripts invoke `pi-mono` with
one skill per transition; shared rules live in [_shared/harness.md](./_shared/harness.md).

## Pipeline

```
preparing ──prepare-story──► planning ──plan-story──► building ──build-story──►
  verifying ──validate-story──► finishing ──finish-story──► done
```

Each phase transition may also run **commit-message** (stdout → git commit).

| Skill | Phase exit | Role |
| ----- | ---------- | ---- |
| [prepare-story](./prepare-story/SKILL.md) | preparing | Capture user intent and repo truth in `card.md` |
| [plan-story](./plan-story/SKILL.md) | planning | Make ACs, tests, tasks, and spec updates consistent |
| [build-story](./build-story/SKILL.md) | building | Implement Build Tasks; log as-built work |
| [validate-story](./validate-story/SKILL.md) | verifying | Run scenarios, check ACs, record evidence |
| [finish-story](./finish-story/SKILL.md) | finishing | Close docs, finalize notes, add Finished marker |
| [commit-message](./commit-message/SKILL.md) | any transition | One Conventional Commit message on stdout |

Canonical card shape: [../assets/story.template.md](../assets/story.template.md).
