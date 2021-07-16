drop schema if exists dynamic_attributes cascade;
create schema dynamic_attributes;
create table dynamic_attributes.objects (
  id int primary key,
  name text not null,
  created_at timestamptz not null default now()
);

create table dynamic_attributes.object_properties (
  id serial primary key,
  object_id int not null references dynamic_attributes.objects on delete cascade,
  category text not null,
  property text not null,
  value text not null
);
alter table dynamic_attributes.object_properties add constraint ak_object_properties_dynamic_attributes unique (object_id, category, property);

comment on table dynamic_attributes.objects is E'@dynamicAttributes dynamic_attributes.object_properties value ak_object_properties_dynamic_attributes';

insert into  dynamic_attributes.objects (id, name) values
  (1, 'Plate'),
  (2, 'Bowl'),
  (3, 'Mug'),
  (4, 'Knife'),
  (5, 'Fork'),
  (6, 'Spoon');

insert into dynamic_attributes.object_properties(object_id, category, property, value) values
  (1, 'Material', 'colour', 'white'),
  (2, 'Material', 'colour', 'blue'),
  (3, 'Material', 'colour', 'black'),
  (4, 'Material', 'colour', 'silver'),
  (5, 'Material', 'colour', 'silver'),
  (6, 'Material', 'colour', 'silver'),
  (1, 'Material', 'substance', 'china'),
  (2, 'Material', 'substance', 'china'),
  (3, 'Material', 'substance', 'china'),
  (4, 'Material', 'substance', 'stainless steel'),
  (5, 'Material', 'substance', 'stainless steel'),
  (6, 'Material', 'substance', 'stainless steel'),
  (2, 'Structure', 'capacity', '500ml'),
  (3, 'Structure', 'capacity', '330ml'),
  (4, 'Structure', 'serrated', '0'),
  (5, 'Structure', 'prongs', '4');

