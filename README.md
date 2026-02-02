# Data Table
A configurable component for creating interactive table views which allow the user to view and edit data
but stops short of offering total analytical insight into the data.

Lives in the [svelte shadcn](https://www.shadcn-svelte.com/) ecosystem, a step more ready-to-use than
[svelte-table](https://ui.shadcn.com/docs/components/data-table)
yet simpler to configure (and less powerful) than  
[tezasr/datagrid](https://github.com/tzezar/datagrid).  
Hence the modest designation as a data "table" rather than a data "grid" component.

What I wanted was the django experience:
table and form views based on my application models or DB views, which support interactive viewing and CRUD out of the box, requiring only a bit of per-view and per-column annotation.

I couldn't find such a component already in the svelte shadcn ecosystem, so I (and my trusty AI) built this.  

If you know of such a thing that I missed, I'd love to hear about it.  I'm not so far down the rabbit hole yet
that I wouldn't consider it!

Status:  it's a science experiment at the moment.  If it pans out, I'd be willing to team up to stabilize and support it.
For now, though, feel free to look at (and comment on) the code.
