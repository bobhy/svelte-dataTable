# dataTable v3 enhancements

Enable row data input form to validate individual fields and the overall record.

Enhance DataTableConfig to allow specification of validation rules.

## column enum list callback
Configuring the enum list callback for a field implies the field is a select field.
Callback is invoked when the form is opened.  Is invoked with no arguments and returns an array of strings to populate the dropdown for that field.
If this callback is configured, there is no need to configure a validator callback.  The form field ensures the value  in the column must match one of these values.

## column (field) validator callback
This callback is invoked when user has navigated out of a field.
It is invoked with the value entered into the field and returns an array of strings representing the error messages.  If the array is empty, the data is considered valid.  If the array is not empty, the data is considered invalid and the error message is displayed in red text below the field.

## row (form) validator callback
Callback invoked when user clicks save as new or update buttons.  It is invoked with an object representing the data in the form.  It should return an array of strings representing the error messages.  If the array is empty, the data is considered valid.  If the array is not empty, the data is considered invalid and the error messages are displayed in red text below the form.

## implementation notes
New field in DataTableConfig -- to allow specification of row validator callback
New fields in DataTableColumn to allow column validator and enum list callbacks
New text field in each data entry field of the RowEditForm which displays any field-level error message.  This field doesn't consume visual space when there is no error message.  The error message should be displayed in red text.

If any of the error fields is populated, the save and save as new buttons should be disabled.  The error field for a field is cleared as soon as a user enters new data into that field.  The error field for the form is cleared as soon as all the individual field error messages are cleared.

Review existing DataTableTypes.ts and DataTable.svelte and remove any unused data structures or dead code.
