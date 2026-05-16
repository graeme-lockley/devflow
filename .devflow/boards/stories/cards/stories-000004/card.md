# CLI Parameter Error Shows usage

Whenever ./devtools is used and the CLI parser reports an error, the error is displayed and the CLI usage is shown.

Please make the following changes:

- Have the error conform to the standard error syntax and colorisation
- Only show the usage when no arguments are supplied on the CLI or the help command is invoked.
