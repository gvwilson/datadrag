# Plan 5

The next step is to implement blocks to do basic data science operations.

1.  Implement a `csv` block that has a flat top and a concave bottom
    so that it can be used as the top of a stack.
    It must have the title `csv`.
    It must have a small file selection box where the user can select a dataset
    from a CSV file on disk and turn it into an arquero dataframe.

2.  Implement a `filter` block that has a convex top and concave bottom
    so that it can be used in a stack.
    It must have the title `filter`.
    It must have a small text entry box where users can type expressions
    such as `age > 65 and color = 'blue'`.
    It must apply this expression to the dataframe it receives as input
    from the block above it.
    to produce a new dataframe as output.

3.  Dataframes must flow from one block to the next in stacked order.

## Clarifying Questions and Answers

**Q1: Execution trigger — what causes a stack to run?**
A: Add a `run` button to the `csv` block to trigger execution.

**Q2: Output — where does the result of a stack go?**
A: Add a `show` block that can be used in the middle or bottom of a stack.
It displays the current dataframe in a pop-up.
It has a text field where the user can enter a name to display in the pop-up.
The `show` block has a convex top and concave bottom so it can appear anywhere in a stack.

**Q3: Filter expression syntax?**
A: Use arquero expression syntax for now.

**Q4: CSV loading — file picker or typed path?**
A: Use the native browser `<input type="file">` file picker.

**Q5: Block UI sizing — how to fit controls in fixed-size blocks?**
A: The `csv`, `filter`, and `show` blocks are wider than standard in the canvas rendering
area, but appear at the same (standard) icon size in the palette.

**Q6: Scope — shapes only, or full execution engine?**
A: Implement full execution: walk the stack top-to-bottom, pass the dataframe
from block to block, and display results when a `show` block is reached.
