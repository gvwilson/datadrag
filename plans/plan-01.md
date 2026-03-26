# Plan 1

## Overview

This project is a browser-based drag-and-drop framework for basic data science.
It enables users to build data analysis pipelines using the operations found in SQL
and in dataframe libraries such as the tidyverse, pandas, and polars.
Each block represents a single operation on the data,
such as input, filter, summarize, or charting.
Operations with a single input and single output can be clicked together to form stacks
similar to those in Scratch.
Some blocks can be connected by lines to allow fan-in and fan-out:
these are used to manage operations such as joining dataframes.
The project is implemented in modern JavaScript and tested using playwright.
The code and build system are very simple.

## Instructions

1.  Initialize a JavaScript project called datadrag in this Git repository,
    including package management, build, and test.

2.  datadrag consists of two parts.
    The first part is shown vertically on the left,
    and shows the blocks that are available.
    The second part is the display of the currently data analysis graph.
    It occupies most of the rendering area.

3.  A user can click on a block to drag it into the drawing area to add a block to the DAG.

4.  A user can click on a block in the drawing area to bring up a context menu.
    That context menu displays the name of type of block (read only),
    an option to delete the block,
    and possibly an option to connect the block to another block
    (depending on the type of the block that was clicked).

5.  If the user clicks on "delete", the block and any connectors to it are deleted.

6.  If "connect" was displayed and the user selects it,
    an arrow connector appears.
    The tail of the arrow is anchored to the block that was clicked.
    The mouse cursor marks the head of the arrow.
    If the user clicks on another block that is capable of receiving connections,
    the two blocks are connected.
    If the user clicks on the background,
    the arrow disappears and no connection is created.

7.  If the user clicks on the drawing area itself,
    a context menu appears.
    The only option in that context menu now is "undo".
    The application supports infinite undo.

8.  An *input block* has a flat top and a slightly concave bottom.
    It does not allow arrow connections in or out.

9.  An *output block* has a slightly convex top and a flat bottom.
    It does not allow arrow connections in or out.

10. A *pipeline block* has a slightly convex top and a slightly concave bottom.
    It does not allow arrow connections in or out.

11. A "fan-in block" has two small circular knobs on its left side,
    a flat top,
    and a slightly concave bottom.
    A single arrow may be connected to each of the knobs.
    The head of the arrow much connect to the knob.

12. A "fan-out block" has a slightly convex top,
    a flat bottom,
    and a single circular knob on its right side.
    Any number of arrows may come *out* of that knob.

13. Once blocks are created,
    the user can drag them around by clicking and dragging.
    Any arrows connecting blocks stay anchored to the knobs on their blocks.

14. A block with a concave bottom can be stacked on a block with a convex top
    by dragging the top block close to the bottom block and releasing it.
    The blocks then click together to form a stack.
    Any number of blocks may be stacked,
    but only if their tops and bottoms are compatible.

15. If the top block in a stack is dragged, the whole stack drags.

16. If the second or lower block in a stack is dragged, the stack separates at that point
    and only the block that was clicked and the blocks below it moved (in a new stack).

### Decisions

Rendering
:   Use SVG (not Canvas).
    Blocks and arrows are discrete interactive objects;
    SVG gives each element its own DOM node,
    simplifying click/drag handling, knob targeting, and Playwright testing.
