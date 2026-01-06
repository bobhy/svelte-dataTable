A configurable component for creating interactive table views which allow the user to view and edit data
but stops short of offering total analytical insight into the data.

Lives in the svelte shadcn ecosystem, a step more ready-to-use than svelte-table 
yet simpler to configure (and less powerful) than tezasr/datagrid.  
Hence the modest designation as a data "table" rather than a data "grid" component.

What I wanted was the django experience: 
table and form views that would support CRUD for all my application data models, requiring only a bit of per-field annotation
and would also support interactive report viewing for all my computed views.
I was willing to configure the fields & columns to be displayed (with the goal of eventually pushing those attributes to the data model, 
but didn't want to have to implement all the interactivity I wanted: infinite scroll, data edit, sorting, filtering, searching...

I couldn't find such a component already in the svelte shadcn ecosystem, so I (and my trusty AI) built this.  

Status:  it's a science experiment at the moment.  Maybe eventually it gets stabilized and amenable to support.
For now, though, feel free to look at (and comment on) the code.
