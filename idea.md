I would like to create an application that will help me manage my boards and AI development workflow by having a deterministic loop over both deterministic and non-deterministic actions.  The idea is that I can setup multiple boards using the command

  devflow init board-name column1 column2 column3

In my typical story workflow, I would use

  ```
  devflow init stories unplanned planning planned building built verifying verified finishing finished blocked
  ```

This tracks the phases that a developement card passes through.

Now, attached to each phase are a set of shell scripts structured a little like Unix runlevels - these scripts are a collection of verification and doing structured as individual tasks and sequenced base on a 3 digit counter. When a script is run by devflow, they are executed in sequence and are interpretted as successful should the script return 0.  Any non-zero value is treated as an error.  For example, a story in planning, when I attempt to move it to planned it would run the following scripts:

  planning-001-verify-git-empty-status
  planning-002-verify-story-structure
  planning-003-perform-planning
  planning-004-verify-planning-quality
  planning-005-verify-git-status
  planning-006-change-card-status
  planning-007-commit-changes

Each of these scripts are passed the board name and the card ID.

In this example, 003 would use pi-mono to perform the actual planning work using a specific skill using a high quality model, 004 would verify the planning quality against a set of criteria using pi-mono with a cheaper model.  Similarly 007 would probably also use a cheaper model to formulate the git commit message using a skill against a standard.  All of the other tasks would be performed mechanincally using normal shell scripting without invoking an LLM.

In this way, the workflow is tighly controlled with a good combination of deterministic and non-deterministic.  Further, this should allow process to be token efficient by not asking an LLM to do any workflow management.

A given board (say called epics) is to be stored in ./devflow/epics

WIthin this directory, there will be a state.json which holds a sequence with all the phase names, a directory scripts which will contain the scripts described above, skills which will contain specific skills use by the scripts, and state which will contain the cards.  The cards directory requires a little more explanation.

Each card has a unique ID.  Ideally this ID is automatically generated with the next ID value stored in state.json.  There is no meaning attached the ID but I would prefer if it is of the form boardID-SequenceID - in this way it is systemically unique.  Insided the cards directory, a directory is created for each card.  The following files are necessary within the card directory:

- state.json - this contains the name of the story, and phase that the story is in, history of data and time of phase changes, as well as any other variable values that a script can update.  Incidentally, these variables are accessed through devflow using the following

  ```
    devflow getvariable epic-315 SESSION_ID
  ```

  This will return the value to stdout, and exit with 0 should the variable be defined, otherwise exit 1 to indicate an error.

  Similarly a variable can be set using

  ```
    devflow setvariable epic-315 SESSION_ID "hello world"
  ```
- card.md - this is the agent and human readable card.  The structure is not mandated by the system and will be defined per board and what phase the card is in.  The scripts, and skills with associated template will create, verify, and enforce the structure.  The following sript creates a card:

  ```
    devflow create-card epic "Beneficiary Add"
  ```

  This will validate that the board exists, determinte the card ID, create the directory, create state.json placing the card in the first phase, and create card.md with nothing more than the title in it.  It will return the card ID to stdout and exit 0 if all successful.  Exit 1 if there was any error.

  ```
    devflow show-card epic-1
  ```

  This will, to stdout, show the card metadata and then the contents of card.md.  The output will be a markdown file.

  It is helpful for agents to have direct access to the directory.  To enable that, the following command will return the card's directory allowing the card to be directly editted.

  ```
    devflow card-directory epic-1
  ```

  Validation must be perform with the directory being returned on stdout and exit 0.  Otherwise exit 1.

- It is possible to attach files to a card using the command

  ```
    devflow add-file epic-1 file-name
  ```

  This will be copied into the card's directory.  Helpful to add evidence where needed.


There are other devflow commands that help manage the flow:

- devflow create-card epic "Add beneficiary validation"
  Creates a new card on the epic board.
- devflow boards list
  Lists all board
- devflow card list epic
  Lists all card on the epic board
- devflow card list epic --state planned
  Lists all card on the epic board in the planned state
- devflow card show epic-42
  Shows card epic-42 card.md content with pertinent metadata
- devflow move epic-42 building
  Move the card epic-42 to building.  If it is beyond the building phase then error.  If it is in the building phase do nothing.  If it is not yet in the building phase then advance it using the scripts
- devflow move epic-42 building --force
  Move it into the building phase irrespective of what phase it is in and do not run any of the scripts.
- devflow block epic-042 "Waiting for API contract"
  Note that the card is blocked with the reason.  Include date and time when the card was blocked in the history.
- devflow unblock epic-042
  Unblock the story returning back into its former phase.
